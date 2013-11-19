# USB adapter for the GEA SDK

This node.js package provides a USB adapter for the [GEA SDK](https://github.com/GEMakers/gea-sdk).
Adapters provide the physical transport mechanism for GEA messages.

## Adapter interface

Each adapter must implement a common interface in order to be used with the GEA SDK.

``` javascript
var configuration = {
    address: 0x00 // the unique device address to bind to
};

// the bind function will attempt to acquire a device instance
// the address specified in the configuration is used to uniquely identify the device
adapter.bind(configuration, function (device) {
  // the callback will be called once the bind completes
  // the device is an object that implements the device interface
});

```
  
## Device interface

When binding was successful a device object is supplied to the bind callback.
Each device object must implement a common interface in order to be used with the GEA SDK.

``` javascript
device.on("message", function (message) {
    // this event is triggered whenever a message has been received
    // each message is an object that implements the message interface
});


// the send function will send a message via the device
// this message must implement the message interface
device.send(message);
```
  
## Message interface

When two endpoints wish to communicate over an adapter, they do so by sending and receiving messages.
Each message must implement a common interface in order to be understood by the endpoint.

``` javascript
message: {
  source: 0x00,        // the address of the sender
  destination: 0x00,   // the address of the recipient
  command: 0x00,       // the command identifier
  data: [ 0x00, 0x00 ] // the message data
}
```

## USB interface

When the bind function is called for this adapter, it will search for all available USB adapters that have a vendor id of 1240 and a product id of 64752.
These identifiers match the GE issued NEWFI USB to RJ45 adapter.
It will then open the USB device and send the address list command (0x01) to it.
This will alert the microcontroller to handle message acknowledgements for the address specified in the configuration.
Once this message has been sent, the USB device will now receive HID messages.
When the HID message is received, it is converted to the message interface.
Likewise, a transformation occurs when sending a message before it goes over the USB device.
