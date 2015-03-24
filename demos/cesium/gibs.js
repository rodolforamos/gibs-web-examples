/**
* GIBS Web Examples
*
* Copyright 2013 - 2015 United States Government as represented by the
* Administrator of the National Aeronautics and Space Administration.
* All Rights Reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var gibs = gibs || {};

gibs.GeographicTilingScheme = function(options) {

    var self = new Cesium.GeographicTilingScheme(options);
    var Math = Cesium.Math;

    var tilePixels = 512;
    var rectangle = Cesium.Rectangle.MAX_VALUE;

    // Resolution: radians per pixel
    var levels = [
        { width:  2,  height:   1, resolution: 0.009817477042468103 },
        { width:  3,  height:   2, resolution: 0.004908738521234052 },
        { width:  5,  height:   3, resolution: 0.002454369260617026 },
        { width:  10, height:   5, resolution: 0.001227184630308513 },
        { width:  20, height:  10, resolution: 0.0006135923151542565 },
        { width:  40, height:  20, resolution: 0.00030679615757712823 },
        { width:  80, height:  40, resolution: 0.00015339807878856412 },
        { width: 160, height:  80, resolution: 0.00007669903939428206 },
        { width: 320, height: 160, resolution: 0.00003834951969714103 }
    ];

    self.getNumberOfXTilesAtLevel = function(level) {
        return levels[level].width;
    };

    self.getNumberOfYTilesAtLevel = function(level) {
        return levels[level].height;
    };

    self.tileXYToRectangle = function(x, y, level, result) {
        var xTiles = levels[level].width;
        var yTiles = levels[level].height;
        var resolution = levels[level].resolution;

        var xTileWidth = resolution * tilePixels;
        var west = x * xTileWidth + rectangle.west;
        var east = (x + 1) * xTileWidth + rectangle.west;

        var yTileHeight = resolution * tilePixels;
        var north = rectangle.north - y * yTileHeight;
        var south = rectangle.north - (y + 1) * yTileHeight;

        if ( !result ) {
            result = new Cesium.Rectangle(0, 0, 0, 0);
        }
        result.west = west;
        result.south = south;
        result.east = east;
        result.north = north;
        return result;
    };

    self.positionToTileXY = function(position, level, result) {
        if ( !Cesium.Rectangle.contains(rectangle, position) ) {
            return undefined;
        }

        var xTiles = levels[level].width;
        var yTiles = levels[level].height;
        var resolution = levels[level].resolution;

        var xTileWidth = resolution * tilePixels;
        var yTileHeight = resolution * tilePixels;

        var longitude = position.longitude;
        if ( rectangle.east < rectangle.west ) {
            longitude += Math.TWO_PI;
        }

        var xTileCoordinate = (longitude - rectangle.west) / xTileWidth | 0;
        if ( xTileCoordinate >= xTiles ) {
            xTileCordinate = xTiles - 1;
        }

        var latitude = position.latitude;
        var yTileCoordinate = (rectangle.north - latitude) / yTileHeight | 0;
        if ( yTileCoordinate > yTiles ) {
            yTileCoordinate = yTiles - 1;
        }

        if ( !result ) {
            result = new Cesium.Cartesian2(0, 0);
        }
        result.x = xTileCoordinate;
        result.y = yTileCoordinate;
        return result;
    };

    return self;
};

gibs.Viewer = function(config) {

    // Initially start at June 15, 2014
    var initialTime = Cesium.JulianDate.fromDate(
            new Date(Date.UTC(2014, 5, 15)));

    // Earliest date of Corrected Reflectance in archive: May 8, 2012
    var startTime = Cesium.JulianDate.fromDate(
            new Date(Date.UTC(2012, 4, 8)));

    var endTime = Cesium.JulianDate.now();

    // Keep track of the previous day. Only update the layer on a tick if the
    // day has actually changed.
    var previousTime = null;
    var selectedSet = null;

    var clock = new Cesium.Clock({
        currentTime: initialTime,
        multiplier: 0   // Don't start animation by default
    });

    // GIBS needs the day as a string parameter in the form of YYYY-MM-DD.
    // Date.toISOString returns YYYY-MM-DDTHH:MM:SSZ. Split at the "T" and
    // take the date which is the first part.
    var isoDate = function(isoDateTime) {
        return isoDateTime.split("T")[0];
    };

    // Create the layer for the current day
    var createProvider = function(layer_id) {
        var layer = config.layers[layer_id];
        var time = "";

        if ( layer.startDate ) {
            var isoDateTime = clock.currentTime.toString();
            time = "?TIME=" + isoDate(isoDateTime);
        }

        var provider = new Cesium.WebMapTileServiceImageryProvider({
            url: "//map1.vis.earthdata.nasa.gov/wmts-geo/wmts.cgi" + time,
            layer: layer.id,
            style: "",
            format: layer.format,
            tileMatrixSetID:
                config.resolutions[layer.resolution].tileMatrixSetID,
            minimumLevel: 0,
            maximumLevel: 8,
            tileWidth: 512,
            tileHeight: 512,
            tilingScheme: gibs.GeographicTilingScheme()
        });

        return provider;
    };

    // Invoked when the current day changes, but do not call this too often
    // if the user is sweeping through days.
    var updateLayers = _.throttle(function() {
        var isoDateTime = clock.currentTime.toString();
        var time = isoDate(isoDateTime);
        var layers = viewer.scene.imageryLayers;
        layers.removeAll();
        _.each(selectedSet.layers, function(layer_id) {
            layers.addImageryProvider(createProvider(layer_id));
        });
    }, 250, {leading: true, trailing: true});;

    // When the clock changes, check to see if the day has changed and
    // replace the current layers/
    var onClockUpdate = function() {
        var isoDateTime = clock.currentTime.toString();
        var time = isoDate(isoDateTime);
        if ( time !== previousTime ) {
            previousTime = time;
            updateLayers();
        }
    };

    var models = [];
    _.each(config.sets, function(set) {
        var model = new Cesium.ProviderViewModel({
            name: set.name,
            tooltip: "Hello",
            iconUrl: "foo.png",
            creationFunction: function() {
                // Return an empty set and update the layers in the same
                // way done when the clock changes.
                selectedSet = set;
                _.defer(updateLayers);
                return [];
            }
        });
        models.push(model);
    });

    var viewer = new Cesium.Viewer("map", {
        clock: clock,
        imageryProviderViewModels: models
    });


    viewer.timeline.zoomTo(startTime, endTime);
    viewer.clock.onTick.addEventListener(onClockUpdate);
    onClockUpdate();

    return viewer;
};

