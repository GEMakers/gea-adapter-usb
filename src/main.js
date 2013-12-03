/*
 * Copyright (c) 2013 - General Electric - Confidential - All Rights Reserved
 * 
 * Author: Christopher Baker <christopher.baker2@ge.com>
 *  
 */

var util = require("util");
var events = require("events");
var hid = require("node-hid");
var stream = require("binary-stream");

const VENDOR_ID = 1240;
const PRODUCT_ID = 64752;
const RAND_MAX = 0xFFFF;
const STATUS_VALID = 0x00;
const COMMAND_ADDRESS_LIST = 0x01;
const COMMAND_DATA = 0x02;
const RETRY_COUNT = 5;

function getRandomMessageId() {
    return Math.floor(Math.random() * RAND_MAX);
}

function Adapter(configuration, hid) {
    var self = this;
    var address_list = [];
    
    function sendPacket(data) {
        var writer = new stream.Writer(data.length + 5);
        
        writer.writeUInt16(getRandomMessageId());
        writer.writeUInt8(0);
        writer.writeUInt8(1);
        writer.writeUInt8(data.length);
        writer.writeBytes(data);
        
        try {
            hid.write(writer.toArray());
        }
        catch (error) {
            self.emit("error", error);
        }
        
        delete writer;
    }

    function updateAddressList() {
        var writer = new stream.Writer(address_list.length + 2);
        writer.writeUInt8(COMMAND_ADDRESS_LIST);
        writer.writeUInt8(address_list.length);
        
        for (var i = 0; i < address_list.length; i++) {
            writer.writeUInt8(address_list[i]);
        }

        sendPacket(writer.toArray());
        delete writer;
    }
    
    function ensureAddressExists(address) {
        for (var i = 0; i < address_list.length; i++) {
            if (address_list[i] == address) {
                return false;
            }
        }
        
        address_list.push(address);
        updateAddressList();
        return true;
    }
    
    function onPacketReceived(packet) {
        var reader = new stream.Reader(packet);
        var type = reader.readUInt8();
            
        if (type == COMMAND_DATA) {
            var status = reader.readUInt8();
                
            if (status == STATUS_VALID) {
                var length = reader.readUInt8();
                var destination = reader.readUInt8();
                var ignored = reader.readUInt8();
                var source = reader.readUInt8();
                var command = reader.readUInt8();
                var data = reader.readBytes(packet.length - 7);
                
                self.emit("message", {
                    command: command,
                    source: source,
                    destination: destination,
                    data: data
                });
            }
        }
        
        delete reader;
    }
    
    function receiveNextPacket() {
        hid.read(function (error, data) {
            if (error) {
                self.emit("error", error);
            }
            else {
                var reader = new stream.Reader(data);
                var message_id = reader.readUInt16();
                var packet_index = reader.readUInt8();
                var packet_count = reader.readUInt8();
                var packet = reader.readBytes(reader.readUInt8());
                
                onPacketReceived(packet);
                delete reader;
            }
                
            receiveNextPacket();
        });
    }
    
    this.send = function(message) {
        ensureAddressExists(message.source);
    
        var writer = new stream.Writer(message.data.length + 19, stream.BIG_ENDIAN);
        
        writer.writeUInt8(COMMAND_DATA);
        writer.writeUInt32(getRandomMessageId());
        writer.writeUInt8(RETRY_COUNT);
        writer.writeUInt8(message.data.length + 4);
        writer.writeUInt8(message.destination);
        writer.writeUInt8(message.data.length + 8);
        writer.writeUInt8(message.source);
        writer.writeUInt8(message.command);
        writer.writeBytes(message.data);
        sendPacket(writer.toArray());
        
        delete writer;
    };
    
    ensureAddressExists(configuration.address);
    receiveNextPacket();
}

util.inherits(Adapter, events.EventEmitter);

exports.bind = function (configuration, callback) {
    var devices = hid.devices(VENDOR_ID, PRODUCT_ID);

    for (var i = 0; i < devices.length; i++) {
        var device = new hid.HID(devices[i].path);
        callback(new Adapter(configuration, device));
    }
};

