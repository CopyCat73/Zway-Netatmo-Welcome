# Zway Netatmo Welcome

Zway Automation module for the Netatmo Welcome camera. It uses the netatmo api to retrieve data at
a specified interval.

# Configuration

First go to https://dev.netatmo.com and log in with your Netatmo user account.
Create a new app for your z-way installation. Enter the client ID, client secret and
your Netatmo credentials in the configuration, along with the desired interval at which
data is retrieved (in minutes). Do not use the same app credentials for different Netatmo modules in zway
(e.g. weather station and welcome).

# Homes and users

Based on your Netatmo configuration the module creates a home and users for each of your Netatmo
Welcome devices. Each identified user in the Welcome station is shown on the dashboard as a binary switch;
off: user left, on: user is home.

# Events

No events are emitted (yet)

# License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or any 
later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
