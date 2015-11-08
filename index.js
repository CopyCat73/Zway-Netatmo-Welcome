/*** Netatmo Welcome Z-Way module *******************************************

Version: 1.00
(c) CopyCatz, 2015
-----------------------------------------------------------------------------
Author: CopyCatz <copycat73@outlook.com>
Description: Netatmo Welcome

******************************************************************************/

function NetatmoWelcome (id, controller) {
    // Call superconstructor first (AutomationModule)
    NetatmoWelcome.super_.call(this, id, controller);
    
    this.client_id          = undefined;
    this.client_secret      = undefined;
    this.username           = undefined;
    this.password           = undefined;
    this.scope              = undefined;
    this.grant_type         = undefined;
    this.access_token       = undefined;
    this.refresh_token      = undefined;
    this.token_expire_time  = undefined;
    this.timer              = undefined;
    this.numberOfHomes      = undefined;
    this.userLocale         = undefined;
    this.devices            = {};
}

inherits(NetatmoWelcome, AutomationModule);

_module = NetatmoWelcome;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

NetatmoWelcome.prototype.init = function (config) {
    NetatmoWelcome.super_.prototype.init.call(this, config);

    var self = this;
    
    this.client_id          = config.client_id.toString();
    this.client_secret      = config.client_secret.toString();
    this.username           = config.username.toString();
    this.password           = config.password.toString();
    this.langFile           = self.controller.loadModuleLang("NetatmoWelcome");

    var intervalTime    = parseInt(self.config.interval) * 60 * 1000;
        
    self.timer = setInterval(function() {
        self.startFetch(self);
    }, intervalTime);
    
    self.startFetch(self);
   
};

NetatmoWelcome.prototype.stop = function () {
    var self = this;
    
    if (self.timer) {
        clearInterval(self.timer);
        self.timer = undefined;
    }
    
    if (typeof self.devices !== 'undefined') {
        _.each(self.devices,function(value, key) {
            self.controller.devices.remove(value.id);
        });
        self.devices = {};
    }
    
    NetatmoWelcome.super_.prototype.stop.call(this);
};

NetatmoWelcome.prototype.addDevice = function(prefix,overlay) {

    var self = this;
    var deviceParams = {
        overlay: overlay,
        deviceId: "NetatmoWelcome_"+prefix+"_" + this.id,
        moduleId: prefix+"_"+this.id
    };
    deviceParams.overlay['deviceType'] = "switchBinary";
    
    self.devices[prefix] = self.controller.devices.create(deviceParams);
    return self.devices[prefix];
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

NetatmoWelcome.prototype.startFetch = function (instance) {

    var self = instance;
    var now_seconds = new Date().getTime() / 1000;
    if (self.token_expire_time==undefined||now_seconds>=self.token_expire_time) {
        //console.logJS('new token needed');
        self.fetchToken(instance);
    }
    else {
        //console.logJS('token ok');
        self.fetchHomeData(instance);
        
    }
}        
        

NetatmoWelcome.prototype.fetchToken = function (instance) {
    
    var self = instance;
    var now_seconds = new Date().getTime() / 1000;
    
    if (self.refresh_token == undefined) {
    
        http.request({
            url: "https://api.netatmo.net/oauth2/token",
            method: "POST",
            headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                grant_type: 'password',
                client_id: this.client_id,
                client_secret: this.client_secret,
                username: this.username,
                password: this.password,
                scope: 'read_camera'
            },
            async: true,
            success: function(response) {
                self.access_token = response.data.access_token;
                self.refresh_token = response.data.refresh_token;
                self.token_expire_time = now_seconds + response.data.expires_in;
                self.fetchHomeData(instance);
            },
            error: function(response) {
                console.error("[NetatmoWelcome] Token fetch error");
                console.logJS(response);
                self.controller.addNotification(
                    "error", 
                    self.langFile.err_fetch_token, 
                    "module", 
                    "NetatmoWelcome"
                );
            }
        });
    }
    
    else {
        http.request({
            url: "https://api.netatmo.net/oauth2/token",
            method: "POST",
            headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                grant_type: 'refresh_token',
                client_id: this.client_id,
                client_secret: this.client_secret,
                refresh_token: this.refresh_token
            },
            async: true,
            success: function(response) {
                self.access_token = response.data.access_token;
                self.refresh_token = response.data.refresh_token;
                self.token_expire_time = now_seconds + response.data.expires_in;
                self.fetchHomeData(instance);
            },
            error: function(response) {
                console.error("[NetatmoWelcome] Refresh token fetch error");
                console.logJS(response);
                self.controller.addNotification(
                    "error", 
                    self.langFile.err_fetch_refreshtoken, 
                    "module", 
                    "NetatmoWelcome"
                );
            }
        });        
    }
};    
    
NetatmoWelcome.prototype.fetchHomeData = function (instance) {
    
    var self = instance;
   
    var url = "https://api.netatmo.com/api/gethomedata?access_token="+this.access_token;
    
    http.request({
        url: url,
        async: true,
        success: function(response) { self.processResponse(instance,response) },
        error: function(response) {
            console.error("[NetatmoWelcome] Home data fetch error");
            console.logJS(response);
            self.controller.addNotification(
                "error", 
                self.langFile.err_fetch_data, 
                "module", 
                "NetatmoWelcome"
            );
        }
    });
};

NetatmoWelcome.prototype.processResponse = function(instance,response) {
    
    console.log("[NetatmoWelcome] Update");
    var self = instance;
    
    if (self.numberOfHomes == undefined) {
        self.numberOfHomes = response.data.body.homes.length;
        self.userLocale = response.data.body.user.reg_locale;
        for (hc = 0; hc < self.numberOfHomes; hc++) {
            var homeName = response.data.body.homes[hc].name;
            var userCount = response.data.body.homes[hc].persons.length;
            for (uc = 0; uc < userCount; uc++) {
                var userName = response.data.body.homes[hc].persons[uc].pseudo;
                if (userName!=null) {
               
                    self.addDevice('home_'+hc+'_'+uc,{
                        metrics : {
                            probeTitle: 'Welcome',
                            icon: '/ZAutomation/api/v1/load/modulemedia/NetatmoWelcome/icon.png',
                            scaleTitle: '?',
                            title: userName + ' ' + homeName
                        }
                    });
                }
            }
        }
    }
   
    for (hc = 0; hc < self.numberOfHomes; hc++) {
        var userCount = response.data.body.homes[hc].persons.length;
        for (uc = 0; uc < userCount; uc++) {
            var userName = response.data.body.homes[hc].persons[uc].pseudo;
            if (userName!=null) {
                if (response.data.body.homes[hc].persons[uc].out_of_sight) {
                    self.devices['home_'+hc+'_'+uc].set('metrics:level','off');
                }
                else {
                    self.devices['home_'+hc+'_'+uc].set('metrics:level','on');
                    //var icon = '/ZAutomation/api/v1/load/modulemedia/Netatmo/'+variable.toLowerCase()+'.png';
                    //self.devices[variable + '_' + dc + '_' + mc].set('metrics:icon', icon);
                }
            }
        }
    }
};

