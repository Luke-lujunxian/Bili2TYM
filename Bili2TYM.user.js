// ==UserScript==
// @name         Bili2TYM (Bilibili audio one click to Youtube Music)
// @namespace
// @version      0.0.6.1
// @description  Pull Audio Stream from Bilibili video and upload to Youtube Music
// @author       Luke_lu
// @match        *.bilibili.com/video/*
// @match        *.bilibili.com/list/*
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
    let display_b = document.createElement("button");//Display edit container
    display_b.innerHTML = "Upload to Youtube Music";
    display_b.style = "position:fixed;right:0px;z-index:9999;top:64px;color:black";

    let container = document.createElement("div");
    container.style = "position:fixed;right:0px;z-index:9999;top:86px;color:black;background-color:white;padding:10px;border:1px solid black";
    container.style.display="none"
    let title_i = document.createElement("input");
    title_i.placeholder = "Title";
    title_i.style = "width:100%"
    let artist_i = document.createElement("input");
    artist_i.style = "width:100%"
    artist_i.placeholder = "Artist";
    container.appendChild(title_i);
    container.appendChild(artist_i);

    display_b.onclick = function(){
        if (container.style.display == "none") {
            container.style.display = "block";
            let videoId = getBVid()
            getCid(videoId).then((cid)=>{//Really bad code
                title_i.value = VideoMeta["title"];
                artist_i.value = VideoMeta["author"];
            });
        }else{
            container.style.display = "none";
        }
    }


    let button = document.createElement("button");
    container.appendChild(button);
    document.body.appendChild(container);
    button.innerHTML = "Submit"
    button.onclick = async function(){
        if (button.innerHTML != "Submit") {
            button.innerHTML = "Working, Please Wait...";
            return;
        }

        button.innerHTML = "Loading Audio Stream...";

        let stream = false
        while ((stream == false)){
            console.log("Getting new URL")
            let url = await getAudioStreamUrl();
            for(let i = 0 ; i < 10 ; i++){
                stream = await getAudioStream(url);
                if (stream == false) {
                    console.log("Upload Failed! Get Audio Stream Error");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    //return;
                }else{
                    break;
                }
            }
        }


        //overwrite title and author, need refector
        VideoMeta["title"] = title_i.value;
        VideoMeta["author"] = artist_i.value;

        let cover = await getCover(VideoMeta["coverURL"]);
        let coverType = cover.name.substring(cover.name.length-3)
        //console.log(cover);

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
        stream = addTags(await audio,await image, coverType);
        if (stream == false || stream.size == 0) {
            alert("Upload Failed! FFmpeg Error");
            button.innerHTML = "Error! Please press F12 to check the console";
            return;
        }


        //DEBUG
        //console.log(stream)

        //saveBlob(stream,'test.mp3')
        //return;

        button.innerHTML = "Uploading...";
        //Upload
        let response = await uploadAudioStream(stream);
        if(response.status == 200){
            alert("Upload Success!");
            if(window.location.href.split("/")[3]!="list")
                button.disabled = true;
            button.innerHTML = "Upload to Youtube Music Done";
            return;
        }else if(response.status == 409){// 409 Conflict
            alert("Upload Failed! The song already exists in your library.");
        }else{
            alert("Upload Failed! Error Code:"+response.status);
            console.log(response);
        }
        button.innerHTML = "Error! Please press F12 to check the console";

    };
    //Wait until the page is loaded
    document.body.appendChild(display_b);

    //console.log(VideoMeta);
})();

var VideoMeta = {};

function addTags(stream,cover,coverType) {

    //console.log(cover);
    let stdout = "";
    let stderr = "";
    //Add a cover image and artist metadata to the audio file
    const result = ffmpeg({
        MEMFS: [{ name: "input.m4a", data: stream }, { name: "cover."+coverType, data: cover }],
        //Sadly only mp3 can have pic, but bilibili video don't have hight bit rate anyway
        arguments: ["-i", "input.m4a", "-i", "cover."+coverType, "-map", "0", "-map", "1","-c:v", "copy", "-c:a", "libmp3lame","-disposition:v:1", "attached_pic","-id3v2_version","3" ,"-q:a", "0", "-metadata", "artist="+VideoMeta['author']+ "","output.mp3"],
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
    return new Blob([out.data], { type: "audio/mp3" });
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
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "User-Agent": window.navigator.userAgent,
                "Range": 'bytes=0-999999999999999',//I don't know, but this may work
                "Cache-Control":"no-cache"
            },
            onload: function (response) {
                if (response.status != 200 && response.status != 206) {

                    console.log(response);
                    reject(false);
                }
                resolve(response.response);
            },
            onerror: function (e) {
                console.error ('**** error ', e);
                resolve(false)
            },
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
                "Referer": window.location.herf,
                //"Origin": "https://www.bilibili.com",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "User-Agent": window.navigator.userAgent,
            },
            onload: function (response) {
                //console.log(response);
                resolve(new File([response.response], "test"+Date.now()+"."+url.substring(url.length-3)));
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
                    data: new File([stream], "test"+Date.now()+".m4a", {type: 'audio/mp3'}),
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

    let videoId = getBVid()
    //console.log("videoId:" + videoId);
    let api = "https://api.bilibili.com/x/player/playurl?" + (videoId[0]=='B'?"bvid=" + videoId:"avid=" + videoId.substring(2)) + "&cid=" + await getCid(videoId) + "&fourk=1&fnver=0&fnval=4048";
    //console.log(api);
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: api,
            onload: function (response) {
                let data = JSON.parse(response.responseText);
                //console.log(typeof data.data.flac === Array?"T":"F");
                //console.log(response)
                //console.log(data)
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
    let api = "https://api.bilibili.com/x/web-interface/view?" + (Vid[0]=='B'?"bvid=" + Vid:"aid=" + Vid.substring(2));
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: api,
            onload: function (response) {
                //console.log(response)
                let data = JSON.parse(response.responseText);
                //console.log(data)
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

function getBVid(){
    let urlEle = window.location.href.split("/");
    let videoId
    if(urlEle[3] == "list"){
        let url2 = window.location.href.split("=")
        videoId = url2[url2.length -1];
    }else{
        videoId = urlEle[urlEle.length - 2];
    }
    return videoId
}

function saveBlob(blob, fileName) {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
};

