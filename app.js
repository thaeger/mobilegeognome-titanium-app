//
//    THE MOBILE GEOGNOME PROJECT
//        Titanium Mobile App
//    www.mobilegeognomeproject.org
//
// COPYRIGHT (C) 2010 Ted Haeger & Scarlett Quill
// 
//            www.scarlettquill.com
//

// app theme, containing colors, fonts & icons
var theme =
    {
        // COLORS
        white: 'white',
        green_dark: '#5F9A42',
        green_light: '#91C73E',
        brown_dark: '#583621',
        brown_light: '#A47855',
        orange_dark: '#ED3624',
        orange_medium: '#F27421',
        orange_light: '#F7991C',
        title_bar: '#583621',
        button_bar: '#5F9A42',
        button_color: '#A47855',
        button_border: '#583621',
        // FONTS
        title_font: {fontSize: 18, fontWeight: 'bold'},
        view_title: {fontSize: 16, fontWeight: 'bold'},
        view_subtitle: {fontSize: 14, fontWeight: 'bold'},
        view_font: {fontSize: 14},
        small_font: {fontSize: 13},
        view_buffer: 10, // buffer space inside view borders
        border_radius: 8,
        // IMAGES
        button: 'images/button.png',
        check: 'images/light_check.png',
        del: 'images/del_29x29.png',
        log: 'images/log_29x29.png',
        globe: 'images/map_29x29.png',
        locate: 'images/gps_29x29.png',
        mail: 'images/Email_29x29_Icon.png',
        more: 'images/more_58x58.png',
        sync: 'images/sync_29x29.png'
    };

// Main UI Vars (included here so that jsLint parser doesn't barf up needless warnings
var maps_key; // api key for android devices
var current_scheme;
var log_dir;
var current_window;
var device_state;
var tab_group;
var log_tab;
var test_win;

// Utility Functions
function pad_number(n) // pad a single-digit number to two digit number
    {
        var num = ("0" + n.toFixed()).slice(-2);
        return num;
    }
function convert_timestamp(milliseconds) // convert timestamp to human-readable dateTime 
    {
        var date = new Date(milliseconds);
        var monthName;
        switch(date.getMonth())
            {
                case 0: monthName = 'JAN';
                break;

                case 1: monthName = 'FEB';
                break;

                case 2: monthName = 'MAR';
                break;

                case 3: monthName = 'APR';
                break;

                case 4: monthName = 'MAY';
                break;

                case 5: monthName = 'JUN';
                break;

                case 6: monthName = 'JUL';
                break;

                case 7: monthName = 'AUG';
                break;

                case 8: monthName = 'SEP';
                break;

                case 9: monthName = 'OCT';
                break;

                case 10: monthName = 'NOV';
                break;

                case 11: monthName = 'DEC';
                break;

            }
        // pad the day to 2 digit number
        var day = "0" + (date.getDate()).toFixed().slice(-2);
        var result = date.getFullYear() + ' ' + monthName + ' ' + pad_number(date.getDate()) + ', ' + pad_number(date.getHours()) + ':' + pad_number(date.getMinutes()) + ':' + pad_number(date.getSeconds());

        return result;
    }
function get_date_from_filename(filename) // get a friendly date from a logfile's millisecond value
    {
        return convert_timestamp(parseInt(filename.replace(/.txt/, ''), 10));
    }
function gen_filename() // generate a unique filename based on time
    {
        return (new Date().valueOf());
    }
function log_as_file(filename, data)
    {
        var f = Ti.Filesystem.getFile(log_dir, filename);
        f.write(data);
    }
function set_sync_badge()
    {
        var dirties = device_state.get_sync_list().length;
        if (dirties > 0) {log_tab.badge = dirties;}
        else {log_tab.badge = null;}
    }

// Classes
function Notifier(text, duration, bottom) // Utility for displaying temp status messages on screen
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        if (duration == null){duration = 3;} // default duration is 3 seconds
        var fadeout = Ti.UI.createAnimation(
            {
                curve: Ti.UI.ANIMATION_CURVE_EASE_IN_OUT,
                opacity: 0,
                duration: 1500,
                delay: 0
            });
        fadeout.addEventListener('complete', function(){current_window.remove(self_ref.view);}); // removes view from screen after fadeout completes
        this.message = Ti.UI.createLabel(
            {
                text: text,
                left: 10,
                right: 10,
                font: {fontSize: 14},
                color: 'white',
                height: 'auto',
                width: 200
            });
        this.view = Ti.UI.createView(
            {
                bottom: bottom,
                borderRadius: 5,
                borderColor: 'gray',
                opacity: 0.7,
                backgroundColor: 'black',
                width: 220,
                height: 20
            });
        this.view.add(this.message);
        current_window.add(this.view);
        setTimeout(function(){self_ref.view.animate(fadeout);}, duration * 1000);
    }
function Device_State() // Class for managing device state
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        this.get_profile = function() //
            {
                var i = {
                            uid: Ti.Platform.id,
                            model: Ti.Platform.model,
                            operating_system: Ti.Platform.name,
                            version: Ti.Platform.version,
                            carrier: 'unknown' // this is not available in Titanium API at this time; may require native code
                        };
                return i;
            };
        this.set_device_info = function(i) // set device info; pass null to erase
            {
                Ti.App.Properties.setString("device_info", JSON.stringify(i));
            };
        this.get_device_info = function() // get last device info; update if none exists
            {
                var device_info = JSON.parse(Ti.App.Properties.getString('device_info'));
                if (!device_info)
                    {
                        Ti.API.info("No previous device info, so generating for current device state.");
                        device_info = this.get_profile();
                        this.set_device_info(device_info);
                    }
                return device_info;
            };
        this.get_log_path = function()
            {
                var path;
                switch(Ti.Platform.name)
                    {
                        case 'iPhone OS':
                            path = Ti.Filesystem.applicationDataDirectory + '/measurements';
                            break;
                        case 'android':
                            path = Ti.Filesystem.applicationDataDirectory + 'measurements';
                    }

                var tmp_dir = Ti.Filesystem.getFile(path);
                if (!tmp_dir.exists())
                    {
                        Ti.API.info('creating ' + path);
                        tmp_dir.createDirectory();
                    }
                return path;
            };

        this.add_to_sync_list = function(filename) // add item to sync_list
            {
                var sync_list = this.get_sync_list();
                    sync_list.push(filename);
                this.set_sync_list(sync_list);
            };
        this.remove_from_sync_list = function(filename)
            {
                var sync_list = this.get_sync_list();
                for (var i = 0; i < sync_list.length; i++ )
                    {
                        if (sync_list[i] == filename){sync_list.splice(i, 1);}
                        this.set_sync_list(sync_list);
                    }
            };
        this.requires_sync = function(filename)
            {
                var f = filename;
                var sync_list = this.get_sync_list();
                var exists = false;
                sync_list.forEach(function(i){if (i == f){exists = true;}});
                return exists;
            };
        this.get_sync_list = function() // read list of tests to sync
            {
                var sync_list = Ti.App.Properties.getList('sync_list', []);
//                for (var i = 0; i < sync_list.length; i++ )
//                        {
//                            var file = Ti.Filesystem.getFile(log_dir, filename);
//                            if (sync_list[i] == filename){sync_list.splice(i, 1);}
//                            this.set_sync_list(sync_list);
//                        }
//                list.forEach(function(filename)
//                    {
//                        var file = Ti.Filesystem.getFile(log_dir, filename);
//                        if (!file.exists(filename))
//                            {
//                            }
//                    });
                return sync_list;
            };
        this.set_sync_list = function(array) // save list of tests to sync
            {
                Ti.App.Properties.setList('sync_list', array);
                set_sync_badge();
            };

        this.set_app_badge = function()
            {
                if (Ti.Platform.name == 'iPhone'){Ti.UI.iPhone.appBadge = this.get_sync_list().length;}
            };
        this.post_results = function(filename)
            {
                var t = Ti.Filesystem.getFile(log_dir, filename);
                if (t.exists())
                    {
                        Ti.API.info('nativepath = \n' + log_dir + '/' + filename);
                        // check whether a value is set on app, and if so, check whether there is network; post, then remove the value
                        var post_data = t.read();
                        Ti.API.info(filename + ' contains \n' + post_data); // DEBUG: outputs file read
                        // post info from here
                        var xhr = Ti.Network.createHTTPClient();
                            xhr.open('POST', "http://mobilegeognome.heroku.com/payload", false);
                            xhr.setRequestHeader("Content-Type", "application/json");
                            xhr.onload = function()
                                {
                                    var m; // status message var
                                    var d; // duration of notifier
                                    Ti.API.info('response = ' + this.status);
                                    if (this.status == 201)
                                        {
                                            m = 'report succeeded';
                                            d = 1;
                                            self_ref.remove_from_sync_list(filename);
                                        }
                                    else
                                        {
                                            m = 'Post fail, Status ' + this.status;
                                            d = 10;
                                            Ti.API.log(m);
                                        }
                                    var s = new Notifier(m, d, 76);
                                };
                            xhr.send(post_data);
                    }
                else
                    {
                        Ti.API.info(filename + ' does not exist--removing from sync_list');
                        this.remove_from_sync_list(filename);
                    }
            };
        this.sync = function()
            {
                var tests = this.get_sync_list();
                var n = new Notifier('Synchronizing ' + tests.length + ' logged tests.', 2, 100);
                tests.forEach(function(t){self_ref.post_results(t);});
            };
                        
        // Are these used??
        this.info = this.get_device_info();
        this.get_geo_state = function()
            {
                var state = JSON.parse(Ti.App.Properties.getString('location'));
                if (state){return state;}
                else {return {"type":"default", "coords":{"timestamp":1293897932265,"altitude":0,"latitude":0.0,"longitude":0.0,"accuracy":10000,"altitudeAccuracy":-1,"heading":-1}};}
            };
//        this.best_geolocation = this.get_geo_state();
        this.has_updated = function() // returns t/f for whether an aspect of device has changed.
            {
                var last_used_profile = this.get_device_info();
                var current_model = this.get_profile();

                if (last_used_profile.model == current_model.model ||
                    last_used_profile.os == current_model.os ||
                    last_used_profile.os_version == current_model.os_version)
                    {return false;}
                else
                    {
                        Ti.API.log(info, 'Device has changed from ' + JSON.stringify(last_used_model) + ' to ' + JSON.stringify(current_model));
                        Ti.API.log(info, 'Resetting previous geolocation state.');
                        this.set_geo_state(null);
                        return true;
                    }
            };
    }
function Key_Value_Label(top, width, label_text, value_text) // for measurement detail view
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        var font = theme.small_font;

        this.view = Ti.UI.createView(
            {
                top: top,
                height: 20,
                width: width
            });
        this.label = Ti.UI.createLabel(
            {
                left: 0,
                width: width/2  - 10,
                textAlign: 'right',
                color: 'black',
                font: font,
                text: label_text + ':'
            });
        this.val_label = Ti.UI.createLabel(
            {
                text: value_text,
                color: 'black',
                font: font,
                width: width/2 - 10,
                left: width/2
            });

        // Assemble
        this.view.add(this.label);
        this.view.add(this.val_label);
    }
function Measurement_Pin(measurement, index)
    {
        this.pin = Ti.Map.createAnnotation(
            {
                latitude: measurement.latitude,
                longitude: measurement.longitude,
                title: "Measurement " + index,
                subtitle: '+/-' + measurement.accuracy + ' meters',
                pincolor: Ti.Map.ANNOTATION_GREEN,
                animate: true
            });
    }
function Test_Log(filename)
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        this.sync_needed = device_state.requires_sync(filename);
        this.file = Ti.Filesystem.getFile(log_dir, filename);
        this.filename = filename;
        this.file_contents = this.file.read();
        this.friendly_date = get_date_from_filename(filename);
        var p = JSON.parse(''+this.file_contents); // the leading quotes avoids a nasty ClassCast exception on Android.
        this.payload = p.payload;
        // functions
        this.del = function(){if (this.file.deleteFile() == true){return true;}else{return false;}};
        this.get_pins = function()
            {
                var pins = [];
                var i = 0;
                self_ref.payload.measurements.forEach(function(m)
                    {
                        pins.push(new Measurement_Pin(m, i+1).pin);
                        i++;
                    });
                return pins;
            };
        this.get_map = function(){return new Log_Map(this.filename);};
    }
function Log_Map(filename)
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        var test_log = new Test_Log(filename);
        this.pins = test_log.get_pins();

        this.win = Ti.UI.createWindow(
            {
                title: 'Log Map',
                barColor: theme.title_bar,
                backgroundColor: 'white'
            });
        this.map = Ti.Map.createView(
            {
                mapType: Ti.Map.HYBRID_TYPE,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                region: {latitude: this.pins[0].latitude, longitude: this.pins[0].longitude, latitudeDelta: 0.005, longitudeDelta: 0.005},
                annotations: this.pins
            });
        //Assemble
        this.win.add(this.map);
    }
function Measurement_Map(measurement, index)
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        this.test_pin = new Measurement_Pin(measurement, index).pin;

        this.win = Ti.UI.createWindow(
            {
                title: 'Measurement ' + index,
                barColor: theme.title_bar,
                backgroundColor: 'white'
            });
        this.detail = new Measurement_Detail({top: 0}, measurement, index);
        this.map = Ti.Map.createView(
            {
                mapType: Ti.Map.HYBRID_TYPE,
                top: 190,
                left: 10,
                right: 10,
                bottom: 10,
                borderRadius: 5,
                borderWidth: 3,
                borderColor: theme.brown_dark,
                region: {latitude: measurement.latitude, longitude: measurement.longitude, latitudeDelta: 0.001, longitudeDelta: 0.001},
                annotations: [this.test_pin]
            });

        //Assemble
        this.win.add(this.detail.view);
        this.win.add(this.map);
    }
function Measurement_Detail(view_props, measurement, index)
    {
        var self_ref = this; // reference to preserve scope of 'this' in callback/anonymous functions
        var i = index;
        var m = measurement;

        this.view = Ti.UI.createView(
            {
                height: 185,
                width: 320
            });
        for (var p in view_props)
            {
                if (view_props.hasOwnProperty(p)){self_ref.view[p] = view_props[p];}
            }
        this.details = Ti.UI.createView(
            {
                top: 10,
                backgroundColor: theme.green_light,
                borderRadius: 5,
                borderWidth: 3,
                borderColor: theme.green_dark,
                height: 175,
                width: 300
            });
        this.header = Ti.UI.createView(
            {
                top: 5,
                left: 20,
                backgroundColor: theme.green_dark,
                borderRadius: 5,
                height: 15,
                width: 'auto'
            });
        this.header_label = Ti.UI.createLabel(
            {
                text: 'Measurement ' + index,
                color: 'white',
                left: 5,
                right: 5,
                font: {fontSize: 12, fontWeight: 'bold'},
                width: 'auto'
            });
        this.timestamp = new Key_Value_Label(10, this.details.width, 'Timestamp', convert_timestamp(measurement.timestamp));
        this.lat = new Key_Value_Label(30, this.details.width, 'Latitude', measurement.latitude);
        this.lon = new Key_Value_Label(50, this.details.width, 'Longitude', measurement.longitude);
        this.geo_acc = new Key_Value_Label(70, this.details.width, 'GPS Accuracy', measurement.accuracy + ' meters');
        this.alt = new Key_Value_Label(90, this.details.width, 'Altitude', measurement.altitude + ' meters');
        this.alt_acc = new Key_Value_Label(110, this.details.width, 'Alt Accuracy', measurement.altitude_accuracy + ' meters');
        this.heading = new Key_Value_Label(130, this.details.width, 'Heading', measurement.heading);
        this.speed = new Key_Value_Label(150, this.details.width, 'Speed', measurement.speed + ' km/h??');

        this.enable_map_view = function()
            {
                this.more_image = Ti.UI.createImageView(
                    {
                        image: theme.more,
                        width: 29,
                        height: 29,
                        right: 15,
                        bottom: 5
                    });
                this.more_image.addEventListener('click', function(){self_ref.open_map();});
                this.view.add(this.more_image);
            };

        // Assemble
        this.header.add(this.header_label);
        this.details.add(this.timestamp.view);
        this.details.add(this.lat.view);
        this.details.add(this.lon.view);
        this.details.add(this.geo_acc.view);
        this.details.add(this.alt.view);
        this.details.add(this.alt_acc.view);
        this.details.add(this.heading.view);
        this.details.add(this.speed.view);
        this.view.add(this.details);
        this.view.add(this.header);

        this.open_map = function()
            {
                var map_win = new Measurement_Map(m, i);
                tab_group.activeTab.open(map_win.win);
            };
    }
function Measurement_Test() // Logic for Measurement Test
    {
        this.test_total = 5; // how many tests to run
        this.count = 1; // counter
        var self_ref = this;
        var test_log = {payload: device_state.get_profile()};
            test_log.payload.measurements = [];

        this.test = setInterval(function()
            {
                Ti.Geolocation.getCurrentPosition(function(e){self_ref.log_event(self_ref.count, e.coords);});
                if (self_ref.count == self_ref.test_total){self_ref.end_test();}
                self_ref.count++;
            }, 2000);
        this.format_event = function(e)
            {
                var formatted_event = e;
                if (formatted_event == null) // handler for android simulator, which doesn't geocode
                    {
                        formatted_event = {"timestamp":1000000000001,"altitude":0,"speed":-1,"latitude":0.0,"longitude":0.0,"accuracy":5000,"heading":-1,"altitude_accuracy":-1};
                    }
                if (formatted_event.altitudeAccuracy) // re-formats for mobile geognome API
                    {
                        formatted_event.altitude_accuracy = formatted_event.altitudeAccuracy;
                        delete formatted_event.altitudeAccuracy;
                    }
                else {formatted_event.altitude_accuracy = 'unavailable';}
                return formatted_event;
            };
        this.log_event = function(index, event)
            {
                var e = this.format_event(event);
                test_log.payload.measurements.push(e);
                test_win.add_pin(e, index);
            };
        this.end_test = function()
            {
                var file_name = gen_filename()  + '.txt';
                clearInterval(this.test);
                log_as_file(file_name, JSON.stringify(test_log));
                device_state.add_to_sync_list(file_name);
            };
    }
function Device_Info_UI(i) // Class for 'Device Info' UI
    {
        // Style Settings
        var view_color = current_scheme.device_info_view;
        var view_border = current_scheme.device_border;
        var title_color = current_scheme.device_title_color;
        var title_font = current_scheme.view_title;
        var font = current_scheme.view_font;
        var font_color = current_scheme.device_font_color;
        var small_font = current_scheme.small_font;
        var buffer = current_scheme.view_buffer;

        this.view = Ti.UI.createView(
            {
                bottom: 60,
                left: 10,
                right: 10,
                height: 80,
                borderRadius: current_scheme.border_radius,
                borderWidth: 3,
                borderColor: view_border,
                backgroundColor: view_color
            });
        this.phone_info_header = Ti.UI.createLabel(
            {
                text:'Device Information',
                font: title_font,
                color: title_color,
                top: 8,
                left: buffer,
                right: buffer,
                height: 'auto'
            });
        this.device_summary = Ti.UI.createLabel(
            {
                top: 32,
                left: buffer,
                right: buffer,
                text: i.info.model + ' running ' + i.info.operating_system + ' v.' + i.info.version,
                font: font,
                color: font_color,
                height: 'auto'
            });
        this.device_id = Ti.UI.createLabel(
            {
                top: 52,
                left: buffer,
                right: buffer,
                text: Ti.Platform.id,
                font: small_font,
                color: font_color,
                height: 'auto'
            });

        this.view.add(this.phone_info_header);
        this.view.add(this.device_summary);
        this.view.add(this.device_id);
    }
function Log_Win(log_filename)
    {
        var self_ref = this;
        var test_log = new Test_Log(log_filename);

        var measure_view_height = 190;

        this.win = Ti.UI.createWindow(
            {
                title: get_date_from_filename(log_filename),
                barColor: theme.title_bar,
                backgroundColor: theme.button_bar
            });
        this.email_button = Ti.UI.createButton(
            {
                top: 5,
                right: 214,
                height: 40,
                width: 96,
                backgroundImage: theme.button,
                color: 'white',
                title: ' Email',
                image: theme.mail
            });
        this.map_button = Ti.UI.createButton(
            {
                top: 5,
                right: 112,
                height: 40,
                width: 96,
                backgroundImage: theme.button,
                color: 'white',
                title: ' Map',
                image: theme.globe
            });
        this.delete_button = Ti.UI.createButton(
            {
                top: 5,
                right: 10,
                height: 40,
                width: 96,
                backgroundImage: theme.button,
                color: 'white',
                title: ' Delete',
                image: theme.del
            });
        this.profile_info = Ti.UI.createLabel(
            {
                top: 10,
                left: 10,
                font: theme.view_title,
                text: test_log.payload.model + ' running ' + test_log.payload.operating_system + ' v.' + test_log.payload.version,
                height: 'auto',
                width: 'auto'
            });
        this.sync_state =  Ti.UI.createLabel(
            {
                top: 26,
                left: 10,
                font: theme.small_font,
                text: (test_log.sync_needed)? 'pending post to mobilegeognome.org':'posted to mobilegeognome.org',
                color: (test_log.sync_needed)? theme.orange_dark:theme.brown_light,
                height: 'auto',
                width: 'auto'
            });
        this.scroll_view = Ti.UI.createScrollView(
                    {
                        top: 50,
                        backgroundColor: 'white',
                        contentWidth: 'auto',
                        showVerticalScrollIndicator: true,
                        contentHeight: 'auto'
                    });

        //Assemble
        this.win.add(this.email_button);
        this.win.add(this.map_button);
        this.win.add(this.delete_button);
        this.scroll_view.add(this.profile_info);
        this.scroll_view.add(this.sync_state);
        this.measures = {}; // for adding measurement view objects
        var i = 0; // index for use in loop
        test_log.payload.measurements.forEach(function(m)
            {
                var d = new Measurement_Detail({top: 40 + (measure_view_height * (i))}, m, i + 1);
                    d.enable_map_view();
                self_ref.measures[''+(i+1)] = d;
                self_ref.scroll_view.add(self_ref.measures[''+(i+1)].view);
                i++;
            });
        this.win.add(this.scroll_view);

        // Event Handlers
        this.win.addEventListener('focus', function(){current_window = self_ref.win;});
        this.delete_button.addEventListener('click', function(){if (test_log.del()){self_ref.win.close();}});
        this.map_button.addEventListener('click', function()
            {
                var map_win = test_log.get_map();
                    tab_group.activeTab.open(map_win.win);
            });
        this.email_button.addEventListener('click', function()
            {
                var email_dialog = Ti.UI.createEmailDialog(
                    {
                        subject: 'Mobile Geognome log from your ' + Ti.Platform.name,
                        messageBody: 'Attached is a JSON log file from a test conducted with the Mobile Geognome Project mobile app.'
                    });
                email_dialog.addAttachment(test_log.file);
                email_dialog.open();
            });
    }
function Log_Row(log_file) // Row object for measurement log
    {
        var self_ref = this;
        this.log = new Test_Log(log_file);

        this.title_string = get_date_from_filename(log_file);
        this.row = Ti.UI.createTableViewRow(
            {
                selectedBackgroundColor: theme.green_dark,
                borderColor: theme.green_dark,
                backgroundColor: theme.green_light,
                leftImage: (this.log.sync_needed)? theme.sync:theme.check,
                file_name: log_file
            });
        this.label = Ti.UI.createLabel(
            {
               text: this.title_string,
               left: 45,
               width: 'auto',
               height: 'auto',
               color: theme.brown_dark
            });
        this.detail_image = Ti.UI.createImageView(
            {
                image: theme.more,
                height: 29,
                width: 29,
                right: 10
            });
        this.row.add(this.label);
        this.row.add(this.detail_image);
        this.row.addEventListener('click', function()
            {
                switch(Ti.Platform.name)
                    {
                        case 'iPhone OS':
                            tab_group.activeTab.open(new Log_Win(self_ref.row.file_name).win);
                            break;
                        case 'android':
                            var detail = new Log_Win(self_ref.row.file_name);
                            detail.win.open();
                    }
            });
    }
function Log_List() // Win that shows measurement logs
    {
        var self_ref = this;
        this.rows = [];

        this.win = Ti.UI.createWindow(
            {
                title: 'Test Logs',
                barColor: theme.title_bar,
                backgroundColor: theme.button_bar
            });
        this.clear_button = Ti.UI.createButton(
            {
                top: 5,
                right: 10,
                height: 40,
                width: 145,
                backgroundImage: theme.button,
                color: 'white',
                title: ' Delete All',
                image: theme.del
            });
        this.table_view = Ti.UI.createTableView(
            {
                top: 50,
                borderColor: theme.button_border,
                deleteButtonTitle: 'Delete',
                data: this.rows
            });
        this.gen_rows = function()
            {
                this.rows = [];
                var dir = Ti.Filesystem.getFile(log_dir);
                var measurement_logs = dir.getDirectoryListing();
//                var measurement_logs = device_state.get_sync_list(); // uncomment this to test curent items to sync
                measurement_logs.forEach(function(l)
                    {
                        if (l.match(/.txt/) && Ti.Filesystem.getFile(l).exists)
                            {
                                var m_row = new Log_Row(l);
                                self_ref.rows.push(m_row.row);
                            }
                    });

            };
        this.refresh = function() // reload the view's data
            {
                this.gen_rows();
                this.table_view.data = this.rows;
                set_sync_badge();
            };

        // Assemble
        this.win.add(this.table_view);
        this.win.add(this.clear_button);

        // Event Handlers
        this.win.addEventListener('focus', function()
            {
                current_window = self_ref.win; // this ref helps for event receiving
                self_ref.refresh();
            });
        this.clear_all = function()
            {
                self_ref.rows.forEach(function(r)
                    {
                        var l = Ti.Filesystem.getFile(log_dir, r.file_name);
                        if (l.exists()){l.deleteFile();}
                    });
                self_ref.refresh();
            };
        this.clear_button.addEventListener('click', function()
            {
                if (self_ref.rows.length == 0){return;}
                // show confirmation dialog
                var a = Ti.UI.createAlertDialog(
                    {
                        title: 'Clear Log?',
                        message: 'This deletes all log information from this device.',
                        buttonNames: ['OK', 'Cancel']
                    });
                    a.addEventListener('click', function(e)
                        {
                            //if confirmed, then delete all, otherwise it just exits
                            if (e.index == 0)
                                {
                                    self_ref.clear_all();
                                }
                        });
                a.show();
            });
    }
function Test_Window() // Window for Main Tab
    {
        var self_ref = this;
        this.win = Ti.UI.createWindow(
            {
                title: 'Mobile Geognome Project v' + Ti.App.version,
                barColor: theme.title_bar,
                backgroundColor: theme.white
            });
        this.map = Ti.Map.createView(
            {
                mapType: Ti.Map.HYBRID_TYPE,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            });
        this.sync_button = Ti.UI.createButton(
            {
                bottom: 10,
                right: 10,
                height: 40,
                width: 145,
                image: theme.sync,
                backgroundImage: theme.button,
                color: 'white',
                selectedColor: theme.brown_dark,
                title: ' Sync'
            });
        this.test_button = Ti.UI.createButton(
            {
                bottom: 10,
                right: 165,
                height: 40,
                width: 145,
                image: theme.locate,
                backgroundImage: theme.button,
                color: 'white',
                selectedColor: theme.brown_dark,
                title: '  Test'
            });
        this.add_pin = function(measurement, index)
            {
                if (index == 1)
                    {
                        this.map.setLocation({latitude: measurement.latitude, longitude: measurement.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01});
                    }
                var mp = new Measurement_Pin(measurement, index);
                this.map.addAnnotation(mp.pin);
            };

        // Assemble
        this.win.add(this.map);
        this.win.add(this.sync_button);
        this.win.add(this.test_button);

        // Event Handlers
        this.win.addEventListener('focus', function(){current_window = self_ref.win;});
        this.sync_button.addEventListener('click', function(){device_state.sync();});
        this.test_button.addEventListener('click', function()
            {
                self_ref.map.removeAllAnnotations();
                var t = new Measurement_Test();
            });
        Ti.Geolocation.getCurrentPosition(function(e)
            {
                self_ref.map.setLocation({latitude: e.coords.latitude, longitude: e.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01});
            });
    }

// geolocation settings
Ti.Geolocation.purpose = "Allow this app to contribute geolocation reports for this device to the Mobile Geognome Project. \nwww.mobilegeognomeproject.org";
Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_BEST;
Ti.Geolocation.distanceFilter = 2; // unused in this version

// globals
device_state = new Device_State();
log_dir = device_state.get_log_path();

// Main App View
tab_group = Ti.UI.createTabGroup(); // main tab group

test_win = new Test_Window();
var test_tab = Ti.UI.createTab(
    {
        icon: theme.globe,
        title: 'Test',
        window: test_win.win
    });
log_tab = Ti.UI.createTab(
    {
        icon: theme.log,
        title: 'Log',
        window: new Log_List().win
    });

// ASSEMBLE
tab_group.addTab(test_tab);
tab_group.addTab(log_tab);
set_sync_badge();

// LAUNCH
tab_group.open();
// Event Handlers
//test_win.win.addEventListener('complete', function()
//    {if(Ti.Network.online == 1){device_state.sync();}});