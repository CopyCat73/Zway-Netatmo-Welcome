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
    this.tokentimer         = undefined;
    this.datatimer          = undefined;
    this.numberOfHomes      = undefined;
    this.userLocale         = undefined;
    this.usingWebhook       = false;
    this.devices            = {};
    this.cameraIndex        = {};
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
        
    self.datatimer = setInterval(function() {
        self.fetchHomeData(self);
    }, intervalTime);
    
    self.fetchToken();
    
    Welcome = function(url, request) {
        
        if (request.body!=undefined) {

            var response = JSON.parse(request.body);            
            self.processWebhook(response)
        }
        
        return 'OK';
    };  
};

NetatmoWelcome.prototype.stop = function () {
    var self = this;
    
    if (self.datatimer) {
        clearInterval(self.datatimer);
        self.datatimer = undefined;
    }
    
    if (self.tokentimer) {
        clearInterval(self.tokentimer);
        self.tokentimer = undefined;
    }
    
    self.removeDevices();
    
    ws.revokeExternalAccess("Welcome");
    Welcome = null;
    if (self.usingWebhook) {
        self.dropWebhook();
    }
    self.numberOfHomes = undefined;
    
    NetatmoWelcome.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

NetatmoWelcome.prototype.addDevice = function(prefix,title) {

    var self = this;
    var overlay =  {
        metrics : {
            probeTitle: 'Welcome',
            icon: '/ZAutomation/api/v1/load/modulemedia/NetatmoWelcome/icon.png',
            scaleTitle: '',
            title: title
        }
    };
    
    var deviceParams = {
        overlay: overlay,
        deviceId: "NetatmoWelcome_"+prefix+"_" + this.id,
        moduleId: prefix+"_"+this.id
    };
    deviceParams.overlay['deviceType'] = "switchBinary";
    
    self.devices[prefix] = self.controller.devices.create(deviceParams);
    return self.devices[prefix];
};

NetatmoWelcome.prototype.addMotionSensor = function(prefix,title) {

    var self = this;
    var overlay =  {
        metrics : {
            probeTitle: 'Welcome',
            icon: '/ZAutomation/api/v1/load/modulemedia/NetatmoWelcome/icon.png',
            scaleTitle: '',
            title: title,
            level: 'off'
        }
    };
    
    var deviceParams = {
        overlay: overlay,
        deviceId: "NetatmoWelcome_"+prefix+"_" + this.id,
        moduleId: prefix+"_"+this.id
    };
    deviceParams.overlay['deviceType'] = "sensorBinary";
    
    self.devices[prefix] = self.controller.devices.create(deviceParams);
    return self.devices[prefix];
};

NetatmoWelcome.prototype.removeDevices = function() {

    var self = this;
    
    if (typeof self.devices !== 'undefined') {
        _.each(self.devices,function(value, key) {
            self.controller.devices.remove(value.id);
        });
        self.devices = {};
    }
}; 

NetatmoWelcome.prototype.fetchToken = function () {
    
    var self = this;

    http.request({
        url: "https://api.netatmo.net/oauth2/token",
        method: "POST",
        headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: {
            grant_type: 'password',
            client_id: self.client_id,
            client_secret: self.client_secret,
            username: self.username,
            password: self.password,
            scope: 'read_camera'
        },
        async: true,
        success: function(response) {
            self.access_token = response.data.access_token;
            self.refresh_token = response.data.refresh_token;
            if(self.tokentimer){
                clearTimeout(self.tokentimer);
            }
            self.tokentimer = setInterval(function() {
                self.fetchRefreshToken();
            }, (response.data.expires_in-100) * 1000);
            self.fetchHomeData(self);
            if (self.config.webhook_url.toString()!='') {
                //ws.allowExternalAccess("Welcome", self.controller.auth.ROLE.USER);
                ws.allowExternalAccess("Welcome", self.controller.auth.ROLE.ANONYMOUS);
                self.setWebhook(self.config.webhook_url.toString());
            }
        },
        error: function(response) {
            console.error("[NetatmoWelcome] Initial token fetch error");
            console.logJS(response);
            self.controller.addNotification(
                "error", 
                self.langFile.err_fetch_token, 
                "module", 
                "NetatmoWelcome"
            );
        }
    });
};

NetatmoWelcome.prototype.fetchRefreshToken = function () {
    
    var self = this;
    
    if (self.refresh_token != undefined) {
        http.request({
            url: "https://api.netatmo.net/oauth2/token",
            method: "POST",
            headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                grant_type: 'refresh_token',
                client_id: self.client_id,
                client_secret: self.client_secret,
                refresh_token: self.refresh_token
            },
            async: true,
            success: function(response) {
                self.access_token = response.data.access_token;
                self.refresh_token = response.data.refresh_token;
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
                // retry over with new base token
                self.fetchToken();
            }
        });
    }
    else {
        console.error("[NetatmoWelcome] Missing refresh token");
        self.refresh_token = undefined;
        // start over with new base token
        self.fetchToken();
    }
};       


    
NetatmoWelcome.prototype.fetchHomeData = function () {
    
    var self = this;
    
    var url = "https://api.netatmo.com/api/gethomedata?access_token="+self.access_token;
    
    http.request({
        url: url,
        async: true,
        success: function(response) { self.processResponse(response) },
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

NetatmoWelcome.prototype.processResponse = function(response) {
    
    console.log("[NetatmoWelcome] Update");
  
    var self = this;
    incomingNumberOfHomes = response.data.body.homes.length;
  
    if (self.numberOfHomes == undefined||self.numberOfHomes!=incomingNumberOfHomes) {
        // new or changed setting
        self.removeDevices();
        self.numberOfHomes = incomingNumberOfHomes;
        self.userLocale = response.data.body.user.reg_locale;
        for (hc = 0; hc < self.numberOfHomes; hc++) {
            var homeName = response.data.body.homes[hc].name;
            var homeID = response.data.body.homes[hc].id;
            var userCount = response.data.body.homes[hc].persons.length;
            self.addDevice('home_' + hc,self.langFile.someone_present + ' ' + homeName);
            for (uc = 0; uc < userCount; uc++) {
                var userName = response.data.body.homes[hc].persons[uc].pseudo;
                var userID = response.data.body.homes[hc].persons[uc].id;
                if (userName!=null) {
                    self.addDevice('person_'+userID,userName + ' ' + homeName);
                }
            }
            if (self.usingWebhook) {
                var cameraCount = response.data.body.homes[hc].cameras.length;
                for (cc = 0; cc < cameraCount; cc++) {
                    var cameraID = response.data.body.homes[hc].cameras[cc].id;
                    var cameraName = response.data.body.homes[hc].cameras[cc].name;
                    self.addMotionSensor('motion_'+cc,cameraName + ' ' + self.langFile.motion);
                    self.cameraIndex[cameraID]=cc;
                }
            }
        }
    }
    
    var homesCheck = [];
    
    for (hc = 0; hc < incomingNumberOfHomes; hc++) {
        var userCount = response.data.body.homes[hc].persons.length;
        var homeID = response.data.body.homes[hc].id;
        homesCheck[hc] = 'off';
        for (uc = 0; uc < userCount; uc++) {
            var userName = response.data.body.homes[hc].persons[uc].pseudo;
            var userID = response.data.body.homes[hc].persons[uc].id;
            if (userName!=null) {
                var switchSetting = response.data.body.homes[hc].persons[uc].out_of_sight ? 'off' : 'on';
                if (switchSetting == 'on') {
                    homesCheck[hc] = 'on';
                }
                if(typeof self.devices['person_' + userID] == "undefined"){
                    console.log("[NetatmoWelcome] no device for user "+userName+" ("+userID+"), creating");
                    self.addDevice('person_' + userID,userName + ' ' + homeName);
                }
                self.devices['person_' + userID].set('metrics:level',switchSetting);
            }
        }
    }
    // global status per home
    for (var hid in homesCheck) {
        self.devices['home_'+hid].set('metrics:level',homesCheck[hid]);
    }
};

NetatmoWelcome.prototype.setWebhook = function(url) {
    
    var self = this;
 
    var base_url = "https://api.netatmo.com/api/addwebhook?access_token="+self.access_token+"&url="+encodeURIComponent(url)+"&app_type=app_camera";
    
    http.request({
        url: base_url,
        async: true,
        success: function(response) {
            if (response.data.status == 'ok') {
                console.log("[NetatmoWelcome] webhook set");
                self.usingWebhook = true;
            }
        },
        error: function(response) {
            console.error("[NetatmoWelcome] webhook set error");
            console.logJS(response);
            self.controller.addNotification(
                "error", 
                self.langFile.err_send_message, 
                "module", 
                "NetatmoWelcome"
            );
        }
    }); 
};

NetatmoWelcome.prototype.dropWebhook = function() {
    
    var self = this;
    var token = self.fetchToken();
    var base_url = "https://api.netatmo.com/api/dropwebhook?access_token="+self.access_token+"&app_type=app_camera";
    
    http.request({
        url: base_url,
        async: true,
        success: function(response) {
            if (response.data.status == 'ok') {
                console.log("[NetatmoWelcome] webhook dropped");
                self.usingWebhook = false;
            }
        },
        error: function(response) {
            console.error("[NetatmoWelcome] webhook drop error");
            console.logJS(response);
            self.controller.addNotification(
                "error", 
                self.langFile.err_send_message, 
                "module", 
                "NetatmoWelcome"
            );
        }
    }); 
};


NetatmoWelcome.prototype.processWebhook = function(response) {
    
    var self = this;
    var message = response["message"];
    console.log("[NetatmoWelcome] Webhook " + message);
    var app_type = response["app_type"];
    var event_type = response["event_type"];
    var camera_id = response["camera_id"];
    var camera_no = self.cameraIndex[camera_id];
    var home_id = response["home_id"];
    var currentDate = new Date();

    if (event_type == 'movement') {
        if (typeof self.devices['motion_'+camera_no]!== undefined) {
            var vDev = self.devices['motion_'+camera_no];
            vDev.set('metrics:level', 'on');
            vDev.set('metrics:timestamp',currentDate.getTime());
            setTimeout(function(){
                var vDev = self.devices['motion_'+camera_no];
                vDev.set('metrics:level', 'off');
                vDev.set('metrics:timestamp',currentDate.getTime());
            }, 10000); 
        }
        else {
            console.log("[NetatmoWelcome] Webhook can't find camera id ");
        }
     }
     else if (event_type == 'person') {
        // more than one person recognized at the same time?
        var personID = response["persons"][0]["id"];
        var isKnown = response["persons"][0]["is_known"];
        if (isKnown) {
            self.devices['person_'+personID].set('metrics:level','on');
        }
        if (typeof self.devices['motion_'+camera_no]!== undefined) {
            var vDev = self.devices['motion_'+camera_no];
            vDev.set('metrics:level', 'on');
            vDev.set('metrics:timestamp',currentDate.getTime());
            setTimeout(function(){
                var vDev = self.devices['motion_'+camera_no];
                vDev.set('metrics:level', 'off');
                vDev.set('metrics:timestamp',currentDate.getTime());
            }, 10000); 
        }
        else {
            console.log("[NetatmoWelcome] Webhook can't find camera id ");
        }
    }
    else if (event_type == 'connection') {
        console.log("[NetatmoWelcome] " + response["home_name"] + "connected");    
    }
    else if (event_type == 'disconnection') {
        console.log("[NetatmoWelcome] " + response["home_name"] + "disconnected");        
    }
    else {
         console.log("[NetatmoWelcome] Unknown webhook"); 
    } 
};        
 
