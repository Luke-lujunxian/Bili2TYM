# Bili2TYM 一键上传B站音频到Youtube Music
一个小Tampermonkey脚本，用于将B站视频的音频轨一键上传到Youtube Music. 特点全程在浏览器端完成，不进行硬盘IO.
## 使用方法
0. 确保两个网站的登录状态
1. 安装`Bili2TYM.user.js`脚本
2. 打开B站视频页面，点击右上角那个格格不入的`Upload to Youtube Music`按钮
3. 等待上传完成
4. Enjoy!
## Credit
This project can't be done without the following projects: 
- [Bilibili API](https://github.com/SocialSisterYi/bilibili-API-collect)
- [Youtube Music API](https://github.com/sigma67/ytmusicapi)
- [FFmpeg.js](https://github.com/Kagami/ffmpeg.js/)
- [browserify](https://github.com/browserify/browserify)
- [Tampermonkey](https://www.tampermonkey.net/)

The `bundle.js` is generated by `browserify` from `mian.js`, which uses `ffmpeg.js/ffmpeg-mp4.js`. All rights belong to `ffmpeg.js/ffmpeg-mp4.js` and the original `FFmpeg project`. 


## 注意事项
- 本脚本仅支持B站视频的**DASH音频轨**上传到Youtube Music。
- 本脚本仅在Chrome浏览器下测试通过。
- 本脚本基于公开的Biilibili API和Youtube Music API,模拟正常的浏览器行为，不会对B站和Youtube Music造成额外的负担。

## Contribute
Feel free to open an issue or pull request or just fork it.🤗
### TODO
- [ ] 上传一图流视频到Youtube主站
- [ ] 上传前编辑视频标题
- [ ] 支持其他音乐平台



## Why?
首先因为Bilibili的听视频功能实在是太难用了，但中文Vocaloid歌曲是最全的。留学生/海外华人用国内音乐平台有版权限制。
### Why youtube music?
因为我有会员，而且Youtube Music的同时能听Youtube上的视频。
