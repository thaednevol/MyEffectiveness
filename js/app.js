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

function onError(e) {
  console.log(e);
}

// FILESYSTEM SUPPORT ----------------------------------------------------------
var fs = null;
var FOLDERNAME = 'test';
var db=null;

function writeFile(blob) {
  if (!fs) {
    return;
  }

  fs.root.getDirectory(FOLDERNAME, {create: true}, function(dirEntry) {
    dirEntry.getFile(blob.name, {create: true, exclusive: false}, function(fileEntry) {
      // Create a FileWriter object for our FileEntry, and write out blob.
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.onerror = onError;
        fileWriter.onwriteend = function(e) {
          console.log('Write completed.');
        };
        fileWriter.write(blob);
      }, onError);
    }, onError);
  }, onError);
}
// -----------------------------------------------------------------------------

var gDriveApp = angular.module('gDriveApp', []);

gDriveApp.factory('gdocs', function() {
  var gdocs = new GDocs();
   	
  var dnd = new DnDFileController('body', function(files) {
    var $scope = angular.element(this).scope();
    Util.toArray(files).forEach(function(file, i) {
      gdocs.upload(file, function() {
        $scope.fetchDocs(true);
      }, true);
    });
  });

  return gdocs;
});
//gDriveApp.service('gdocs', GDocs);
//gDriveApp.controller('DocsController', ['$scope', '$http', DocsController]);

// Main Angular controller for app.
function DocsController($scope, $http, gdocs) {
  $scope.docs = [];
    
    function successCallbackUpload(resp, status, headers, config) {console.log(resp);console.log(status);console.log(headers);console.log(config)}
    
    function updateVal(currentEle, value) {
        $(currentEle).html('<input class="thVal" type="text" value="' + value + '" />');
        $(".thVal").focus();
        $(".thVal").keyup(function (event) {
        if (event.keyCode == 13) {
            $(currentEle).html($(".thVal").val().trim());
            console.log($(currentEle).data('tabla'));
            
            if ($(currentEle).data('tabla')==='mission'){
                var res = db.exec("UPDATE mission SET text='"+$(".thVal").val().trim()+"' WHERE _id=1");
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";
                var reader = new FileReader();
                reader.readAsBinaryString(db);
                var contentType = db.type || 'application/octet-stream';
                var base64Data = btoa(reader.result);
                var multipartRequestBody =
                    delimiter +'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(fileMetadata) +delimiter +
                    'Content-Type: ' + contentType + '\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    '\r\n' +base64Data +close_delim;
                var params={'uploadType': 'multipart', 'alt': 'json'};
                var opt_headers={'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'};
                gdocs.makeRequest("PUT", gdocs.FILE_UPLOAD, successCallbackUpload, opt_data, opt_headers);
            }
            
            $(".edit-db").dblclick(function (e) { editDblClk(e,this); });
        }});
    }
	
    function editDblClk(e,t){
        e.stopPropagation();      //<-------stop the bubbling of the event here
        e.preventDefault(); 
        var currentEle = $(t);
        var value = $(t).html();
        updateVal(currentEle, value);
        $(".edit-db").off("dblclick");
        return false;
    }
    
    $(".edit-db").dblclick(function (e) { editDblClk(e,this); });
    
	function openBCP(blob){
		
		var uInt8Array = new Uint8Array(blob);
		db = new SQL.Database(uInt8Array);
		var mission = db.exec("SELECT * FROM mission");
        console.log(mission);
        var missionText=mission[0].values[0][1];
        
        $('#main-mission-content').html(missionText);
        $('#main-mission-content').data('tabla','mission');
        $('#main-mission-content').data('datos',mission);
        return;
		
		var uints = new Uint8Array(blob);
		var db = new SQL.Database(uints);
		// Prepare an sql statement
		console.log(uints);
		var res = db.exec("SELECT `name`, `sql`\n  FROM `sqlite_master`\n  WHERE type='table';");
		console.log(res);

		// Bind values to the parameters and fetch the results of the query
		var result = stmt.get();
		console.log(result); 
	}
	
  function getBCP(resp, status, headers, config) {
	  var totalEntries = resp.items.length;
	  
	  console.log(resp.items[0]);
	  
	  var file=resp.items[0];
	  var config = {
		  responseType: 'blob',
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
	  /*
	  $http.get(file.downloadUrl, config).success(function(blob) {	  
	     openBCP(blob);	
	  });
	  */
	  var xhr = new XMLHttpRequest();
	  xhr.open('GET',file.downloadUrl , true);
	  xhr.setRequestHeader("Authorization", 'Bearer ' + gdocs.accessToken);
      xhr.responseType = 'arraybuffer';

      xhr.onload = function(e) {
		  openBCP(this.response);
		};
		xhr.send();
  }
	
  // Response handler that caches file icons in the filesystem API.
  function successCallbackWithFsCaching(resp, status, headers, config) {
	var docs = [];

    var totalEntries = resp.items.length;

    resp.items.forEach(function(entry, i) {
      console.log(entry);
		var doc = {
        
		title: entry.title,
        updatedDate: Util.formatDate(entry.modifiedDate),
        updatedDateFull: entry.modifiedDate,
        icon: entry.iconLink,
        alternateLink: entry.alternateLink,
        size: entry.fileSize ? '( ' + entry.fileSize + ' bytes)' : null
      };

      // 'http://gstatic.google.com/doc_icon_128.png' -> 'doc_icon_128.png'
      doc.iconFilename = doc.icon.substring(doc.icon.lastIndexOf('/') + 1);

      // If file exists, it we'll get back a FileEntry for the filesystem URL.
      // Otherwise, the error callback will fire and we need to XHR it in and
      // write it to the FS.
      var fsURL = fs.root.toURL() + FOLDERNAME + '/' + doc.iconFilename;
      window.webkitResolveLocalFileSystemURL(fsURL, function(entry) {
        console.log('Fetched icon from the FS cache');

        doc.icon = entry.toURL(); // should be === to fsURL, but whatevs.

        $scope.docs.push(doc);

        // Only want to sort and call $apply() when we have all entries.
        if (totalEntries - 1 == i) {
          $scope.docs.sort(Util.sortByDate);
          $scope.$apply(function($scope) {}); // Inform angular we made changes.
        }
      }, function(e) {

        $http.get(doc.icon, {responseType: 'blob'}).success(function(blob) {
          console.log('Fetched icon via XHR');

          blob.name = doc.iconFilename; // Add icon filename to blob.

          writeFile(blob); // Write is async, but that's ok.

          doc.icon = window.URL.createObjectURL(blob);

          $scope.docs.push(doc);
          if (totalEntries - 1 == i) {
            $scope.docs.sort(Util.sortByDate);
          }
        });

      });
    });
  }

  
	
	
  $scope.clearDocs = function() {
    $scope.docs = []; // Clear out old results.
  };

  $scope.fetchDocs = function(retry) {
    this.clearDocs();
	  
	  

    if (gdocs.accessToken) {
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
		
		$http.get(gdocs.DOC_SEARCH+"title='MyEffectiveness.bcp'", config).
		success(getBCP).
		error(function(data, status, headers, config) {
          if (status == 401 && retry) {
            gdocs.removeCachedAuthToken(
                gdocs.auth.bind(gdocs, true, 
                    $scope.fetchDocs.bind($scope, false)));
          }
        });
		
     /* 
	  $http.get(gdocs.DOCLIST_FEED, config).
        success(successCallbackWithFsCaching).
        error(function(data, status, headers, config) {
          if (status == 401 && retry) {
            gdocs.removeCachedAuthToken(
                gdocs.auth.bind(gdocs, true, 
                    $scope.fetchDocs.bind($scope, false)));
          }
        });
		*/
    }
  };

  // Toggles the authorization state.
  $scope.toggleAuth = function(interactive) {
    if (!gdocs.accessToken) {
      gdocs.auth(interactive, function() {
        $scope.fetchDocs(false);
      });
    } else {
      gdocs.revokeAuthToken(function() {});
      this.clearDocs();
    }
  }

  // Controls the label of the authorize/deauthorize button.
  $scope.authButtonLabel = function() {
    if (gdocs.accessToken)
      return 'Deauthorize';
    else
      return 'Authorize';
  };

  $scope.toggleAuth(false);
}

DocsController.$inject = ['$scope', '$http', 'gdocs']; // For code minifiers.

// Init setup and attach event listeners.
document.addEventListener('DOMContentLoaded', function(e) {
  var closeButton = document.querySelector('#close-button');
  closeButton.addEventListener('click', function(e) {
    window.close();
  });

  // FILESYSTEM SUPPORT --------------------------------------------------------
  window.webkitRequestFileSystem(TEMPORARY, 1024 * 1024, function(localFs) {
    fs = localFs;
  }, onError);
  // ---------------------------------------------------------------------------
});
