/*
Copyright (c) 2009-2012, Dan "Ducky" Little & GeoMOOSE.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/**
 * Class: GeoMOOSE.MapSource.WMS
 * Provides a WMS MapSource to GeoMOOSE.
 *
 * Inherits from:
 *  - <GeoMOOSE.MapSource>
 */


dojo.provide('GeoMOOSE.MapSource.WMS');

dojo.require('GeoMOOSE.MapSource');

dojo.declare('GeoMOOSE.MapSource.WMS', [GeoMOOSE.MapSource], {

	/**
	 * Method: _createOLLayer(options)
	 * Internal method to create the OpenLayers Layer object. 
	 * This is divorced from the constructor so it can be overriden
	 * without hitting an inheritance chain.
	 *
	 * Parameters:
	 *  options - OpenLayers Layer Options hash.
	 */
	_createOLLayer: function(options) {
		this._ol_layer_name = GeoMOOSE.id();
		this._ol_layer = new OpenLayers.Layer.WMS(
			this._ol_layer_name,
			this.urls,
			this.params,
			options
		);	
	},

	/**
	 * Constructor: constructor
	 * Creates a new WMS MapSource
	 * 
	 * Parameters:
	 *  mapbook_entry - XML fragment defining the MapSource
	 */
	constructor: function(mapbook_entry) {
		/* get all the URLs */
		this.urls = [];
		var urls = mapbook_entry.getElementsByTagName('url');
		for(var i = 0, len = urls.length; i < len; i++) {
			this.urls.push(OpenLayers.Util.getXmlNodeValue(urls[i]));
		}

		var transitionEffect = CONFIGURATION.layer_options.transitionEffect;
		if(transitionEffect == "null")
			transitionEffect = null;

		/* OpenLayers internal options */
		var options = {
			singleTile : !parseBoolean(mapbook_entry.getAttribute('tiled'), false),
			isBaseLayer: false,
			ratio: CONFIGURATION.layer_options.ratio, /* (1) only applies in single tile mode */
			buffer: CONFIGURATION.layer_options.buffer, /* (0) only applies in tiled/gridded mode */
			transitionEffect: transitionEffect,
			visibility: this.isVisible()
		};

		transitionEffect = mapbook_entry.getAttribute('transitionEffect');
		if(transitionEffect) {
			if(transitionEffect == "null")
				transitionEffect = null;
			options.transitionEffect = transitionEffect;
		}

		if(options.singleTile) {
			var buffer = parseFloat(mapbook_entry.getAttribute('buffer'));
			if(buffer) {
				options.ratio = buffer;
			}
		} else { /* !singleTile */
			var w = mapbook_entry.getAttribute('width');
			var h = mapbook_entry.getAttribute('height');
			if(w && h) {
				options.tileSize = new OpenLayers.Size(parseFloat(w), parseFloat(h));
			}
			var buffer = parseInt(mapbook_entry.getAttribute('buffer'));
			if(buffer) {
				options.buffer = buffer;
			}
		}


		if(!GeoMOOSE.isDefined(this.params['FORMAT'])) {
			this.params['FORMAT'] = 'image/png';
		}
		if(!GeoMOOSE.isDefined(this.params['TRANSPARENT'])) {
			this.params['TRANSPARENT'] = 'TRUE';
		}

		this._createOLLayer(options);

		if(GeoMOOSE.isDefined(this.attributes['opacity'])) {
			this.setOpacity(parseFloat(this.attributes['opacity']));
		}

		this.updateParameters({});

		this.onLayersChange();
	},

	/**
	 * Method: onLayersChange
	 * When the Layers List changes, update the params, and refresh the layer.
	 */

	onLayersChange: function(path, visibility) {
		this._ol_layer.params['LAYERS'] = this._getLayersList().join(',');
		this.inherited(arguments);
		this._ol_layer.redraw();
	},

	getUrl: function() {
		return this.urls;
	},

	setUrl: function(url) {
		this.urls = [url];
		this._ol_layer.url = url;
	},

	updateParameters: function(params) {
		this.inherited(arguments);
		this._ol_layer.mergeNewParams(this.params);
	},

	clearParameters: function() {
		var keepers = ['service','version','request','styles','format'];
		var new_params = {};
		for(var i = 0, ii = keepers.length; i < ii; i++) {
			new_params[keepers[i]] = this._ol_layer.DEFAULT_PARAMS[keepers[i]];
		}
			
		this._ol_layer.params = new_params;
	},

	getLegendUrls: function(paths) {
		/* Yummy string hacking... */
		var legendURL = this._ol_layer.getURL(OpenLayers.Bounds.fromArray(GeoMOOSE.getExtent())).replace('REQUEST=GetMap', 'REQUEST=GetLegendGraphic');
		legendURL += '&SCALE=' + GeoMOOSE.getScale();

		var layers = this._getLayersList();
		var legend_urls = [];

		var add_to_list = false;
		if(paths instanceof Array) {
			/* TODO: Really need to come up with a sane way of handling heirarchy! */
			for(var i = 0, len = paths.length; i < len; i++) {
				paths[i] = paths[i].split('/')[1];
			}

			for(var p = 0, plen = paths.length; p < plen; p++) {
				if(dojo.indexOf(layers, paths[p]) >= 0) {
					legend_urls.push(legendURL + '&LAYER=' + paths[p]);
				}
			}
		} else {
			/* if we're not locking it down, then just return everything */
			for(var i = 0, len = layers.length; i < len; i++) {
				legend_urls.push(legendURL + '&LAYER=' + layers[i]);
			}
		}

		return legend_urls;
	},


	/*
	 * Method: getLayerParams
	 * 
	 * Parameters:
	 *  all_params - Get all the parameters from the WMS, instead of just
	 *   the internal ones.
	 */
	getLayerParams: function(all_params) {
		if(all_params === true) {
			var p = {};
			dojo.mixin(p, OpenLayers.Util.upperCaseObject(this._ol_layer.params));
			dojo.mixin(p, this.params);
			return p;
		}
		return this.params;
	},

	/*
	 * Method: print
	 * 
	 * Return the print representation of this layer.
	 */

	printable: true, /* this can be printed */
	
	print: function() {
		var print_obj = {
			'type' : 'wms',
			'url' : this.urls[0],
			'layers' : this._getLayersList(),
			'legends' : this.getLegendUrls(),
			'params' : this.getLayerParams(true)
		};
		return print_obj;
	}

});

GeoMOOSE.registerMapSourceType('wms', GeoMOOSE.MapSource.WMS);
