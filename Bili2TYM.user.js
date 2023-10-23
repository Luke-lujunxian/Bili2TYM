// ==UserScript==
// @name         Bili2TYM (Bilibili audio one click to Youtube Music)
// @namespace    
// @version      0.0.1
// @description  Pull Audio Stream from Bilibili video and upload to Youtube Music
// @author       Luke_lu
// @match        *.bilibili.com/video/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @require      https://cdn.jsdelivr.net/gh/Luke-lujunxian/Bili2TYM/bundle.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect     akamaized.net
// @connect     bilivideo.com
// @connect     youtube.com
// @connect     hdslb.com
// @connect     bilibili.com
// ==/UserScript==


(function() {
    'use strict';
    
    let button = document.createElement("button");
    button.innerHTML = "Upload to Youtube Music";
    button.style = "position:fixed;right:0px;z-index:9999;top:64px;color:black";
    let div = document.createElement("div");
    button.onclick = async function(){
        if (button.innerHTML != "Upload to Youtube Music") {
            button.innerHTML = "Working, Please Wait...";
            return;
        }

        button.innerHTML = "Loading Audio Stream...";
        let url = await getAudioStreamUrl();
        let stream = await getAudioStream(url);
        if (stream == false) {
            alert("Upload Failed! Get Audio Stream Error");
            return;
        }

        let cover = await getCover(VideoMeta["coverURL"]);
        //console.log(stream);
        
        button.innerHTML = "Converting...";
        //Convert stream to Uint8Array
        let reader1 = new FileReader();
        reader1.readAsArrayBuffer(stream);
        let audio = new Promise((resolve, reject) => {
            reader1.onload = function () {
                resolve(new Uint8Array(reader1.result));
            };
        });

        //Convert cover to Uint8Array
        let reader2 = new FileReader();
        reader2.readAsArrayBuffer(cover);
        let image = new Promise((resolve, reject) => {
            reader2.onload = function () {
                resolve(new Uint8Array(reader2.result));
            };
        });

        //Add cover and tags
        stream = addTags(await audio,await image);
        if (stream == false) {
            alert("Upload Failed! FFmpeg Error");
            button.innerHTML = "Error! Please press F12 to check the console";
            return;
        }

        button.innerHTML = "Uploading...";
        //Upload
        let response = await uploadAudioStream(stream);
        if(response.status == 200){
            alert("Upload Success!");
            button.innerHTML = "Upload to Youtube Music";
            return;
        }else if(response.status == 409){// 409 Conflict
            alert("Upload Failed! The song already exists in your library.");
        }else{
            alert("Upload Failed! Error Code:"+response.status);
            console.log(response);
        }
        button.innerHTML = "Error! Please press F12 to check the console";

    };
    document.body.appendChild(button);
    //console.log(VideoMeta);
})();

var VideoMeta = {};

function addTags(stream,cover) {

    //console.log(stream);
    let stdout = "";
    let stderr = "";
    //Add a cover image and artist metadata to the audio file
    const result = ffmpeg({
        MEMFS: [{ name: "input.m4a", data: stream }, { name: "cover.jpg", data: cover }],
        //Sadly youtube music doesn't support cover image
        //arguments: ["-i", "input.m4a", "-i", "cover.jpg", "-map", "0", "-map", "1", "-c", "copy","-disposition:v:1", "attached_pic" , "-metadata", "artist="+VideoMeta['author']+ "","output.mp4"],
        //arguments: ["-i", "input.m4a", "-map", "0", "-c", "copy", "-metadata", "artist="+VideoMeta['author']+ "","output.mp4"],
        print: function(data) { stdout += data + "\n"; },
        printErr: function(data) { stderr += data + "\n"; },
        onExit: function(code) {
            if (code != 0) {
                console.log("Process exited with code " + code);
                console.log(stdout);
                console.log(stderr);
            }
        },
    })
    const out = result.MEMFS[0];
    if (out === undefined) {
        return false;
    }
    return new Blob([out.data], { type: "audio/mp4" });
}

function getAudioStream(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "blob",
            headers: {
                "Referer": "https://www.bilibili.com/",
                "Origin": "https://www.bilibili.com",
                "Accept": "*/*",
                "User-Agent": window.navigator.userAgent
            },
            onload: function (response) {
                if (response.status != 200) {
                    console.log(response);
                    reject(false);
                }
                resolve(response.response);
            },
            onerror: function (response) {
                reject(response);
            }
        });
    });
}

function getCover(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "blob",
            headers: {
                "Referer": "https://www.bilibili.com/",
                "Origin": "https://www.bilibili.com",
                "Accept": "*/*",
                "User-Agent": window.navigator.userAgent
            },
            onload: function (response) {
                //console.log(response);
                resolve(new File([response.response], "test"+Date.now()+".jpg", {type: 'image/jpg'}));
            },
            onerror: function (response) {
                reject(response);
            }
        });
    });
}


function uploadAudioStream(stream) {
    let fileName = VideoMeta["title"]
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({// Init Upload
            method: "POST",
            url: "https://upload.youtube.com/upload/usermusic/http?authuser=0",
            data: "filename="+fileName,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': stream.size,
                'X-Goog-Upload-Protocol': 'resumable'
            },
            onload: function (response) {// Upload
                //console.log(response);
                let headers = response.responseHeaders.split('\n');
                let uploadUrl = '';
                for (let i = 0; i < headers.length; i++) {
                    if (headers[i].startsWith('x-goog-upload-url:')) {
                        uploadUrl = headers[i].substring('x-goog-upload-url:'.length).trim();
                        break;
                    }
                }
                //console.log('Upload URL:', uploadUrl);
                GM_xmlhttpRequest({
                    method: "POST",
                    url: uploadUrl,
                    data: new File([stream], "test"+Date.now()+".m4a", {type: 'audio/mp4'}),
                    body: "filename="+fileName,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                        'X-Goog-Upload-Command': 'upload, finalize',
                        'X-Goog-Upload-Offset': 0,
                        "Referer": "https://music.youtube.com/",
                        "Origin": "https://music.youtube.com",
                        "Accept": "*/*",
                        "Sec-Fetch-Site": "same-site",
                    },
                    onload: function (response) {
                        resolve(response);
                    },
                    onerror: function (response) {
                        console.log(response);
                        reject(response);
                    }
                });
            },
            onerror: function (response) {
                console.log(response);
                reject(response);
            }
        });
    });
}


async function getAudioStreamUrl() {
    let urlEle = window.location.href.split("/");
    let videoId = urlEle[urlEle.length - 2];
    //console.log("videoId:" + videoId);
    let api = "https://api.bilibili.com/x/player/playurl?" + videoId[0].toLowerCase()+"vid=" + videoId + "&cid=" + await getCid(videoId) + "&fnval=16&fourk=1";
    //console.log(api);  
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: api,
            onload: function (response) {
                let data = JSON.parse(response.responseText);
                //console.log(typeof data.data.flac === Array?"T":"F");

                //console.log("Audio Stream Url:" + data.data.dash.audio[0].baseUrl);
                //console.log("FLAC Audio Stream Url:" + typeof data.data.flac === Array?data.data.flac[0].baseUrl:"None");
                resolve(typeof data.data.flac === Array?data.data.flac[0].baseUrl:data.data.dash.audio[0].baseUrl); //flac优先 但我没有会员所以不知道有没有用
            },
            onerror: function (response) {
                reject(response);
            }
        });
    });
}

function getCid(Vid){
    let api = "https://api.bilibili.com/x/web-interface/view?" + Vid[0].toLowerCase() + "vid=" + Vid;
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: api,
            onload: function (response) {
                let data = JSON.parse(response.responseText);
                VideoMeta["title"] = data.data.title;
                VideoMeta["coverURL"] = data.data.pic;
                VideoMeta["author"] = data.data.owner.name;
                //console.log("CID:"+data.data.cid);
                resolve(data.data.cid);
            },
            onerror: function (response) {
                reject(response);
            }
        });
    });
}


