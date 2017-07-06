/*
Copyright 2012 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Eric Bidelman (ericbidelman@chromium.org)
*/

"use strict";


function GDocs(selector) {

  var SCOPE_ = 'https://www.googleapis.com/drive/v2/';

  this.lastResponse = null;

  this.__defineGetter__('SCOPE', function() {
    return SCOPE_;
  });

  this.__defineGetter__('DOCLIST_FEED', function() {
    return SCOPE_ + 'files';
  });
	
  this.__defineGetter__('DOC_SEARCH', function() {
    return SCOPE_ + 'files?q=';
  });
	
  this.__defineGetter__('GET_DOC', function() {
    return SCOPE_ + 'files/';
  });	

  this.__defineGetter__('CREATE_SESSION_URI', function() {
    return 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable';
  });

  this.__defineGetter__('DEFAULT_CHUNK_SIZE', function() {
    return 1024 * 1024 * 5; // 5MB;
  });
    
  this.__defineGetter__('FILE_UPLOAD', function() {
    return "https://www.googleapis.com/upload/drive/v2/files";
  });
};

GDocs.prototype.auth = function(interactive, opt_callback) {
  try {
    chrome.identity.getAuthToken({interactive: interactive}, function(token) {
      if (token) {
        this.accessToken = token;
        opt_callback && opt_callback();
      }
    }.bind(this));
  } catch(e) {
    console.log(e);
  }
};

GDocs.prototype.removeCachedAuthToken = function(opt_callback) {
  if (this.accessToken) {
    var accessToken = this.accessToken;
    this.accessToken = null;
    // Remove token from the token cache.
    chrome.identity.removeCachedAuthToken({ 
      token: accessToken
    }, function() {
      opt_callback && opt_callback();
    });
  } else {
    opt_callback && opt_callback();
  }
};

GDocs.prototype.revokeAuthToken = function(opt_callback) {
  if (this.accessToken) {
    // Make a request to revoke token
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
             this.accessToken);
    xhr.send();
    this.removeCachedAuthToken(opt_callback);
  }
}

/*
 * Generic HTTP AJAX request handler.
 */
GDocs.prototype.makeRequest = function(method, url, callback, opt_data, opt_headers) {
  
	console.log(url);
	
  var data = opt_data || null;
  var headers = opt_headers || {};

  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);

  // Include common headers (auth and version) and add rest. 
  xhr.setRequestHeader('Authorization', 'Bearer ' + this.accessToken);
  for (var key in headers) {
    xhr.setRequestHeader(key, headers[key]);
  }

  xhr.onload = function(e) {
    this.lastResponse = this.response;
    console.log("RESPUESTA: ");
      console.log(xhr);
      callback(this.lastResponse, this);
      
  }.bind(this);
  xhr.onerror = function(e) {
      console.log("ERROR");
    console.log(this, this.status, this.response,
                this.getAllResponseHeaders());
  };
  xhr.send(data);
};



/**
 * Uploads a file to Google Docs.
 */
GDocs.prototype.upload = function(blob, callback, retry) {

  var onComplete = function(response) {
      document.getElementById('main').classList.remove('uploading');
      var entry = JSON.parse(response).entry;
      callback.apply(this, [entry]);
    }.bind(this);
  var onError = function(response) {
      if (retry) {
        this.removeCachedAuthToken(
            this.auth.bind(this, true, 
                this.upload.bind(this, blob, callback, false)));
      } else {
        document.getElementById('main').classList.remove('uploading');
        throw new Error('Error: '+response);
      }
    }.bind(this);


  var uploader = new MediaUploader({
    token: this.accessToken,
    file: blob,
    onComplete: onComplete,
    onError: onError
  });

  document.getElementById('main').classList.add('uploading');
  uploader.upload();

};


GDocs.prototype.download=function(file,callback){
    if (file.downloadUrl) {
        var accessToken = this.accessToken;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', file.downloadUrl,true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
            callback(this.response);
        };
        xhr.onerror = function() {
            callback(null);
        };
        xhr.send();
        } else {
            callback(null);
        }
}

GDocs.prototype.updateDB=function(callback){
    var dbStr = window.localStorage.getItem("MyEffectiveness.sqlite");
        var dbMod = new SQL.Database(Util.toBinArray(dbStr));
        
        var mission = dbMod.exec("SELECT * FROM mission");
        console.log("MISION GUARDADA");
        console.log(mission);
        
        var docId = $(document).data('doc-id');
        var fileMetadata=$(document).data('doc-file');
        
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        //var reader = new FileReader();
        //reader.readAsBinaryString(db);
        var contentType = dbMod.type || 'application/x-sqlite3';

        var arraybuff = dbMod.buffer;
        var blob = new Blob([arraybuff]);
        var base64Data = btoa(blob);

        var multipartRequestBody =
            delimiter + 'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(fileMetadata) +
            delimiter + 
            'Content-Type: '+contentType+'\r\n' +
            'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +base64Data +
            close_delim;

        var opt_headers={'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'};
        
        console.log(multipartRequestBody);
    
        var formData = new FormData();
        formData.append('uploadType', 'multipart');
        formData.append('alt', 'json');
        formData.append('body', multipartRequestBody);
    
        $.ajax({
          url: 'https://www.googleapis.com/upload/drive/v3/files/'+docId,
          type: 'PATCH',
          headers: {
            "Authorization": 'Bearer ' + this.accessToken,
            "Content-Type": 'multipart/related; boundary="'+ boundary + '"'
          },
          success: function() {
            console.log('>>> DONE');
          },
          error: function(e) {
            console.log(e);
          },
          data: dbMod,
          cache: false,
          contentType: false,
          processData: false,
          crossDomain: true
        });
    
    
        //this.makeRequest("PUT", this.FILE_UPLOAD+?uploadType=multipart+docId, callback, params, opt_headers);
}
