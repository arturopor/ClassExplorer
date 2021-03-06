var Logic = function (parent) {

    this.umlExplorer = parent;

};

/**
 * Modify data, add relations, connections, helpers.
 *
 * @param {*} data
 */
Logic.prototype.process = function (data) {

    var self = this,
        cls, clsName;

    this.data = data;

    if (data.savedView) try {
        data.savedView = JSON.parse(data.savedView);
    } catch (e) {
        delete data.savedView;
        console.log("! Unable to deserialize savedView.");
    }

    data.classes["%Persistent"] = data.classes["%Library.Persistent"] = {
        $classType: "Persistent"
    };
    data.classes["%SerialObject"] = data.classes["%Library.SerialObject"] = {
        $classType: "Serial"
    };
    data.classes["%Library.RegisteredObject"] = data.classes["%RegisteredObject"] = {
        $classType: "Registered"
    };
    data.classes["%Library.DataType"] = data.classes["%DataType"] = {
        $classType: "DataType"
    };

    if (!this.data.inheritance) this.data.inheritance = {};
    for (clsName in data.classes) {
        cls = data.classes[clsName];
        if (cls.Super) cls.Super.split(",").forEach(function (name) {
            self.inherits(clsName, name);
        });
        if (cls.parameters && !this.umlExplorer.settings.showParameters) delete cls.parameters;
        if (cls.properties && !this.umlExplorer.settings.showProperties) delete cls.properties;
        if (cls.methods && !this.umlExplorer.settings.showMethods) delete cls.methods;
        if (cls.queries && !this.umlExplorer.settings.showQueries) delete cls.queries;
        if (cls.xdatas && !this.umlExplorer.settings.showXDatas) delete cls.xdatas;
    }

    if (!this.umlExplorer.settings.showDataTypesOnDiagram) {
        for (clsName in data.classes) {
            if (/%Library\..*/.test(clsName)) delete data.classes[clsName];
        }
    }

    this.fillAssociations();
    this.fillIndices();

    delete data.classes["%Persistent"];
    delete data.classes["%Library.Persistent"];
    delete data.classes["%SerialObject"];
    delete data.classes["%Library.SerialObject"];
    delete data.classes["%Library.RegisteredObject"];
    delete data.classes["%RegisteredObject"];
    delete data.classes["%Library.DataType"];
    delete data.classes["%DataType"];

};

/**
 * This method inherits all property properties from inherited classes.
 * @param {string} className
 * @param {string} propertyName
 * @returns {boolean} - if property name was taken (exists in inherited classes)
 */
Logic.prototype.takePropertyFromSuper = function (className, propertyName) {

    var self = this, cls,
        newProperty;

    if (!this.data || !this.data.classes || !(cls = this.data.classes[className])) return false;

    function getP (cls) {
        var sups, prop = {}, p;
        cls = cls || {};
        sups = (cls.Super || "").split(",");
        if (cls.Inheritance === "right") sups.reverse();
        sups.forEach(function (sup) {
            if (!(p = self.data.classes[sup])) return;
            prop = lib.extend(prop, getP(p));
        });
        if (cls.properties && (p = cls.properties[propertyName])) {
            prop = lib.extend(prop, p);
        }
        return prop;
    }

    if (!lib.isEmptyObject(newProperty = getP(cls))) {
        cls.properties[propertyName] = newProperty;
        return true;
    } else return false;

};

Logic.prototype.fillIndices = function () {

    var className, cls, indexName, j, index, props, propName;

    for (className in this.data.classes) {
        cls = this.data.classes[className];
        for (indexName in cls.indices) {
            index = cls.indices[indexName];
            props = (index["Properties"] || "?").split(",");
            for (j in props) {
                if (cls.properties[propName = props[j].match(/[^\(]+/)[0]]
                    || this.takePropertyFromSuper(className, propName)) {
                    cls.properties[propName].index = index;
                } else {
                    console.warn(
                        "No property", propName, "defined in", className,"to assign index",
                        indexName, "to."
                    );
                }
            }
        }
    }

};

Logic.prototype.fillAssociations = function () {

    var self = this,
        className, properties, propertyName, po, assoc, compos, aggr;

    if (!(assoc = this.data.association)) assoc = this.data.association = {};
    if (!(compos = this.data.composition)) compos = this.data.composition = {};
    if (!(aggr = this.data.aggregation)) aggr = this.data.aggregation = {};

    for (className in this.data.classes) {
        properties = this.data.classes[className]["properties"];
        if (!properties) continue;
        for (propertyName in properties) {
            po = properties[propertyName];
            if (po["Cardinality"] === "one") {
                if (!aggr[po["Type"]]) aggr[po["Type"]] = {};
                aggr[po["Type"]][className] = {
                    left: "many",
                    right: "one",
                    from: { in: "properties", name: propertyName },
                    to: { in: "properties", name: po["Inverse"] }
                };
            } else if (po["Cardinality"] === "parent") {
                if (!compos[po["Type"]]) compos[po["Type"]] = {};
                compos[po["Type"]][className] = {
                    left: "child",
                    right: "parent",
                    from: { in: "properties", name: propertyName },
                    to: { in: "properties", name: po["Inverse"] }
                };
            } else if (self.data.classes[po["Type"]] && !po["Cardinality"]) {
                if (!assoc[po["Type"]]) assoc[po["Type"]] = {};
                assoc[po["Type"]][className] = {
                    from: { in: "properties", name: propertyName }
                };
            }
        }
    }

};

/**
 * @private
 * @param {string} className
 * @param {string} inhName
 */
Logic.prototype.inherits = function (className, inhName) {

    if (!this.data.inheritance[className]) this.data.inheritance[className] = {};
    if (!this.data.inheritance[className][inhName]) {
        this.data.inheritance[className][inhName] = 1;
    } else {
        return;
    }

    if (!this.data.classes[inhName]) {
        this.data.classes[inhName] = {};
    }

};