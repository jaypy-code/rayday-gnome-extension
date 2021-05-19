// imports
const
    Clutter = imports.gi.Clutter,
    St = imports.gi.St,
    Gio = imports.gi.Gio,
    GLib = imports.gi.GLib,
    Lang = imports.lang;

const
    Main = imports.ui.main,
    PopupMenu = imports.ui.popupMenu,
    PanelMenu = imports.ui.panelMenu;


/**
 * File system database
 * You can access at '$HOME/.rayday.DATABASE.json'
 */
const DATABASE = {
    'Mode': parseInt('0744', 8),
    'Name': '.rayday.DATABASE.json',
    'Path': () => GLib.build_filenamev([GLib.get_home_dir(), DATABASE.Name]), // create full path
    'File': () => Gio.File.new_for_path(DATABASE.Path()),
    'write': function (data = {}) {  // write data on database file
        if (GLib.mkdir_with_parents(DATABASE.File().get_parent().get_path(), DATABASE.Mode) === 0) {
            DATABASE.File().replace_contents(JSON.stringify(data), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        }
    },
    'read': function () { // read data from database file
        try {
            let data = DATABASE.File().load_contents(null)[1];
            return JSON.parse(data);
        } catch (error) { // if file not exists , create one
            this.write({});
            return {};
        }
    }
};

const Rayday = new Lang.Class({
    Name: 'Rayday',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(0.0, "Rayday", false);

        this.date = Date.now(); // set date to today

        this._Create(); // create every things by date
    },

    _Create() {
        let date = new Date(this.date);
        let key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; // create a object key like: 'YEAR-MONTH-DAY'
        let object = DATABASE.read(); // read all data from database

        // set actions list items to []
        this.items = [];

        // if key exists in object (database) set items from database
        if (key in object) this.items = object[key];

        // delete useless variables
        delete object;
        delete key;
        delete date;

        // A button on gnome panel
        this._CreatePanelButton();

        // A input to get new actions
        this._CreateInput();

        this._Divider();

        // A list of all items
        this._CreateItemList();

        // Create items from this.items and add them to list
        this._UpdateList();

        this._Divider();

        // A footer to change date and switch between them
        this._CreateFooter();
    },

    _CreatePanelButton: function () {
        this.PanelButton = new St.Bin();

        let icon = new St.Icon({
            icon_name: 'x-office-calendar-symbolic',
            style_class: 'system-status-icon'
        });

        this.PanelButton.set_child(icon);

        this.actor.add_actor(this.PanelButton);
    },

    _CreateInput() {
        // Create a container for input
        let base = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });

        // Create a input
        this.entry = new St.Entry({
            name: 'entry',
            style_class: 'search-entry',
            can_focus: true,
            hint_text: 'Add new action',
            track_hover: true
        });

        // Listen to 'Enter' and add new action to the list 
        this.entry.clutter_text.connect(
            'activate',
            Lang.bind(this, this._OnNewActionAddedFromInput)
        );

        // Add input to container
        base.actor.add(this.entry);

        this.menu.addMenuItem(base);
    },

    _CreateItemList() {
        // create a section for this.items
        this.list = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.list);
    },

    _CreateFooter() {
        let that = this; // store this on that because of functions in functions issue
        // create a container for footer
        let base = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });

        // IconButton Widget (component)
        function Button(icon_name = '', callback = function () { }) {
            let icon = new St.Icon({
                icon_name: icon_name,
                style_class: 'system-status-icon'
            });

            let button = new St.Bin({
                style_class: 'ci-action-btn footer-button',
                reactive: true,
                can_focus: true,
                track_hover: true,
                can_focus: true,
                child: icon
            });

            button.set_x_align(Clutter.ActorAlign.END);
            button.set_y_expand(true);

            button.connect('button-press-event', callback);

            return button;
        }

        // next day button
        function NextDay() {
            return Button(
                'go-next-symbolic-rtl',
                function () {
                    let date = new Date(that.date);
                    date.setDate(date.getDate() + 1);
                    that.date = date.getTime();
                    that.menu.removeAll();
                    that._Create();
                }
            );
        }

        // previous day button
        function PreviousDay() {
            return Button(
                'go-previous-rtl-symbilic',
                function () {
                    let date = new Date(that.date);
                    date.setDate(date.getDate() - 1);
                    that.date = date.getTime();
                    that.menu.removeAll();
                    that._Create();
                }
            )
        }

        // refresh this.items button and move to today
        function Refresh() {
            return Button(
                'system-reboot-symbolic',
                function () {
                    that.date = Date.now();
                    that.menu.removeAll();
                    that._Create();
                }
            );
        }

        // show date on right bottom corner
        function TodayLabel() {
            const date = new Date(that.date);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            let label = new St.Label({
                text: `${date.getDate()}th of ${months[date.getMonth()]}`,
                style_class: 'footer-text'
            });

            label.set_x_align(Clutter.ActorAlign.END);
            label.set_y_expand(true);
            label.set_x_expand(true);

            return label;
        }

        base.actor.add(NextDay());
        base.actor.add(Refresh());
        base.actor.add(PreviousDay());
        base.actor.add(TodayLabel());

        this.menu.addMenuItem(base);
    },

    _OnNewActionAddedFromInput() {
        // Get value from input
        let value = this.entry.get_text();
        // Make input empty
        this.entry.set_text('');
        // create a item object
        let item = {
            'text': value,
            'uid': Date.now(),
            'done': false
        };
        // Push to items
        this.items.push(item);

        // Update Database
        this._SaveItems();

        // Update List
        this._UpdateList();
    },

    _AddItem(item = { 'text': '', 'uid': 0, 'done': false }) {
        let that = this;
        // create a container for item
        let base = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });

        // a button with item.text and when press the button change done action to false and true (toggle button)
        function Content() {
            let label = new St.Label({
                text: item.text,
                style_class: ` system-status-label ${item.done ? 'line-on-text' : ''}` // if action is done , make a line on text
            });

            let button = new St.Bin({
                style_class: 'system-status-icon ci-action-btn',
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_expand: true,
                can_focus: true,
                child: label
            });

            button.connect('button-press-event', function () {
                that._ToggleDoneItem(item.uid);
            });

            return button;
        }

        // delete action button on right side
        function DeleteButton() {
            let icon = new St.Icon({
                icon_name: 'edit-delete-symbolic',
                style_class: 'system-status-icon'
            });

            let button = new St.Bin({
                style_class: 'ci-action-btn',
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_expand: true,
                can_focus: true,
                child: icon
            });

            button.set_x_align(Clutter.ActorAlign.END);
            button.set_y_expand(true);
            button.set_x_expand(true);

            button.connect('button-press-event', function () {
                that._RemoveItem(item.uid);
            });

            return button;
        }

        base.actor.add(
            Content()
        );
        base.actor.add(
            DeleteButton()
        );

        this.list.addMenuItem(base);
    },

    _Divider() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    // if list was empty show a default message
    _EmptyList() {
        let base = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });

        let label = new St.Label({
            'text': 'Your action list is empty !',
        });

        label.set_x_align(Clutter.ActorAlign.CENTER);
        label.set_y_expand(true);
        label.set_x_expand(true);


        base.add(label);

        this.list.addMenuItem(
            base
        );
    },

    // remove all items on list and make them again. if this.items was empty , show a message else show actions 
    _UpdateList() {
        this.list.removeAll();

        if (this.items.length == 0) this._EmptyList();
        else
            for (let item of this.items) this._AddItem(item);
    },

    // toggle done each actions by uid and update database and list
    _ToggleDoneItem(uid = '') {
        let index = this.items.findIndex((value) => value['uid'] == uid);
        if (index >= 0) {
            this.items[index]['done'] = !this.items[index]['done'];
            this._SaveItems();
            this._UpdateList();
        }
    },

    // remove a action by uid and update database and list
    _RemoveItem(uid = '') {
        let index = this.items.findIndex((value) => value['uid'] == uid);
        if (index >= 0) {
            this.items.splice(index, 1);
            this._SaveItems();
            this._UpdateList();
        }
    },

    // save data on database by date
    _SaveItems() {
        let date = new Date(this.date);
        let key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        let object = DATABASE.read();

        if (this.items.length != 0)
            object[key] = this.items;
        else
            delete object[key];

        DATABASE.write(object);
    }
});

let rayday;

function init() {
    //
}

function enable() {
    rayday = new Rayday();
    Main.panel.addToStatusArea('rayday', rayday);
}

function disable() {
    rayday.destroy();
}
