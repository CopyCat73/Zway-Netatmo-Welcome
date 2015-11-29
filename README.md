# Zway Netatmo Welcome

Zway Automation module for the Netatmo Welcome camera. It uses the netatmo api to retrieve data at
a specified interval.

# Configuration

NB: this is a camera module, it's under devices > cameras in the settings.
First go to https://dev.netatmo.com and log in with your Netatmo user account.
Create a new app for your z-way installation. Enter the client ID, client secret and
your Netatmo credentials in the configuration, along with the desired interval at which
data is retrieved (in minutes). Do not use the same app credentials for different Netatmo modules in zway
(e.g. weather station and welcome).

# Homes and users

Based on your Netatmo configuration the module creates a home and users for each of your Netatmo
Welcome devices. Each identified person in the Welcome station is shown on the dashboard as a binary switch;
off: person left, on: person is home. For each home there's also a presence binary switch created.
Whenever there's one ore more persons at home, this device is on.

# Webhook

Netatmo also allows a webhook to be set. This sends instant event updates  back to your z-wave device through a url.
If you want to activate a webhook, follow these steps:

    - the webhook runs as /Webhook/ under your zway server, so https://yourrazzberryip:8083/Welcome/
    - Add the Welcome module to your system and go to the Welcome url in your browser. This should display "OK".
    - Next set up your proxy. Example nginx config:
            location /Welcome/ {
                proxy_pass http://yourrazberryip:8083/Welcome/;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto https;
                proxy_redirect    off;
        }
    - The webhook requires https. 
    - Make sure this configuration is correct. If the Netatmo webhook does not receive a http status 200
    repeatedly, it stops sending updates for 24 hours. Check your apache/nginx log for incoming webhook
    events from Netatmo and fix any errors fast or you have to wait another day.
    
If the webhook is working correctly, the person and home status should be updated instantly (without the
webhook it will poll at your defined interval). This will also add a motion detector for the camera to
your devices, which will trigger for 10 seconds everytime the camera sees motion.


# License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or any 
later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
