# Ad Skipper

Automatically skip YouTube ads on AppleTV using Hyperion.ng JSON API.

## How to use

First you need to install [pyatv](https://pyatv.dev/documentation/#latest-stable-version).

Create an environment file and put the following variables:

```properties
# IP address of your Hyperion.ng instance
HYPERION_HOST=""
# Hyperion JSON API port
HYPERION_PORT=""
# IP address of the AppleTV you want to control
APPLETV_HOST=""
# Generate these using the atvremote cli tool:
# https://pyatv.dev/documentation/atvremote/#pairing-with-a-device
AIRPLAY_CREDENTIALS=""
COMPANION_CREDENTIALS=""
```

Run the app using `npm start`
