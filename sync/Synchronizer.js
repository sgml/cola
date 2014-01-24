/** @license MIT License (c) copyright 2010-2013 original author or authors */

/**
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author Brian Cavalier
 * @author John Hann
 */

(function(define) { 'use strict';
define(function(require) {

	var jsonPatch = require('../lib/jsonPatch');
	var when = require('when');

	function Synchronizer(clients) {
		this.clients = clients;
		this._start = 0;
	}

	Synchronizer.prototype = {
		set: function(data) {
			return this._init(data);
		},

		_init: function(data, source) {
			this._shadow = jsonPatch.snapshot(data);
			this._clientsWindow = this.clients.concat(this.clients);

			var self = this;
			this.clients.forEach(function(client) {
				// FIXME: Yuck, interface check
				if(client !== source && client.set) {
					client.set(data);
				}

				if(typeof client.changed === 'function') {
					client.changed = function() {
						self.syncNow(client);
					}
				}
			});
		},

		fromSource: function(source) {
			var self = this;
			return when(source.get(), function(data) {
				self._init(data, source);
				return self;
			});
		},

		sync: function() {
			var client = this.clients[this._start];
			if(!client) {
				return;
			}

			this._start = nextIndex(this._start, this.clients.length);
			return this._syncClientIndex(client, this._start);
		},

		syncNow: function(client) {
			var start = this.clients.indexOf(client);
			if(start >= 0) {
				return this._syncClientIndex(client, nextIndex(start, this.clients.length));
			}
		},

		_syncClientIndex: function(client, start) {
			var patch = client.diff(this._shadow);
			if(patch && patch.length) {
				patch = jsonPatch.snapshot(patch);
				this._shadow = jsonPatch.patch(patch, this._shadow);

				return this._patchClients(patch, this._clientsWindow.slice(start, start + this.clients.length - 1));
			}
		},

		_patchClients: function(patch, clientsToPatch) {
			return clientsToPatch.map(function(c) {
				return c.patch(patch);
			});
		}
	};

	return Synchronizer;

	function nextIndex(i, len) {
		return (i + 1) % len;
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));