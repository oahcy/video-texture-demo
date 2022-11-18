import { _decorator, Material, Component, Node, EventMouse, Texture2D, Sprite, Renderer, SpriteFrame, gfx} from 'cc';
import { Vec3, input, Input, EventHandler, VideoClip} from 'cc';
const { ccclass, property } = _decorator;


const VIDEO_JS_URL: string = 'https://vjs.zencdn.net/7.20.3/video.min.js';

export enum EventType {     //事件类型
    PREPARING = 1,      //准备中
    LOADED = 2,         //已加载
    READY = 3,          //准备完毕
    COMPLETED = 4,      //播放完成
    ERROR = 5,          //播放错误
    PLAYING = 6,        //播放中
    PAUSED = 7,         //暂停
    STOPPED = 8,        //停止
    BUFFER_START = 9,       //
    BUFFER_UPDATE = 10,
    BUFFER_END = 11
};

enum VideoState {       //视频状态
    ERROR = -1,         // 出错状态   
    IDLE = 0,           // 置空状态
    PREPARING = 1,      //准备中
    PREPARED = 2,       //准备完成
    PLAYING = 3,        //播放中
    PAUSED = 4,         //暂停
    COMPLETED = 5       //播放完成
};

enum ReadyState {       //准备状态
    HAVE_NOTHING = 0,       
    HAVE_METADATA = 1,
    HAVE_CURRENT_DATA = 2,
    HAVE_FUTURE_DATA = 3,
    HAVE_ENOUGH_DATA = 4    
};

enum PixelFormat {  //像素格式
    NONE = -1,      
    I420 = 0,        //yuv
    RGB = 2,        //rgb
    NV12 = 23,      //nv12
    NV21 = 24,      //nv21
    RGBA = 26       //rgba
};


@ccclass('VideoTextureComponent')
export class VideoTextureComponent extends Component {
    private _videojs: any = null;
    private _video: any = null;
    private _loaded: boolean = false;                   //是否加载
    private _currentState = VideoState.IDLE;    //当前状态
    private _url: string = '';
    private _nativeWidth: number = 0;           //原生的视频宽          
    private _nativeHeight: number = 0;          //原生的视频高
    private _pixelFormat = PixelFormat.NONE;             //像素格式
    private _seekTime: number = 0;               //搜寻时间 
    private _targetState = VideoState.IDLE;       //目标状态       
    private _volume: number = -1;
    private _texture0: Texture2D = new Texture2D();     //通道0
    private _texture1: Texture2D = new Texture2D();     //通道1
    private _texture2: Texture2D = new Texture2D();     //通道2
    private _frameCounts: number = 0;

    // video event handler for editor
    @property([EventHandler])
    public videoPlayerEvent: EventHandler[] = [];

    // material
    @property([Material])
    protected materials: Material[] = [];

    @property
    private _source: string = '';             //视频链接

    @property
    private _clip: VideoClip = null;            //视频资源

    @property
    get source() {
        return this._source;
    }
    @property
    removeGreenScreen: boolean = false;  //是否抠绿幕

    @property(VideoClip)
    get clip() {
        return this._clip;
    }

    set clip(value: VideoClip) {
        this._clip = value;
        if (this._video) {
            this._updateVideoSource();
        }
    }
    
    set source(value: string) {
        this._source = value;
        if (this._video) {
            this._updateVideoSource();
        }
    } 

    start() {
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        this._initializeVideoJS(()=> {
            this._updateVideoSource();
        });
    }

    update(deltaTime: number) {
        if (!this._isInPlaybackState()) {
            return;
        }

        this._updatePixelFormatInMaterial();
        if (!this._video) {
            return;
        }
        this._frameCounts++;
        if (this._frameCounts % 6 > 0) {
            return;
        }
        let arr = this._video.el_.getElementsByTagName('video');
        let video = arr && arr.length >= 1 ? arr[0] : null;
        if (video !== null) {
            console.log(`${this.node.name} : ${this._video.currentTime()}`)
            this._texture0.uploadData(video);
        }
    }

    onMouseUp(event: EventMouse) {
        if (this._currentState != VideoState.PLAYING) {
            this.play();
        }
    }

    private _initializeVideoJS(callback: Function) {
        console.log("_initializeVideoJS");
        this._loadScriptAsynWithParam(VIDEO_JS_URL, () => {
            this._videojs = document.createElement('video');
            this._videojs.className = 'video-js';
            this._video = window['videojs'](this._videojs, {}, () => {
                console.log('videojs');
                this._video.crossOrigin('anonymous');
                this._video.autoplay(false);
                this._video.loop(false);
                this._video.muted(false);  
                this._loaded = false;
                let onCanPlay = (ar: any) => {
                    if (this._loaded || this._currentState == VideoState.PLAYING)
                        return;
                    if (this._video.readyState() === ReadyState.HAVE_ENOUGH_DATA ||
                        this._video.readyState() === ReadyState.HAVE_METADATA) {
                        this._video.currentTime(0);
                        this._loaded = true;
                        this._onReadyToPlay();
                    }
                };
                this._video.ready(onCanPlay.bind(this));
                this._video.on('loadedmetadata', onCanPlay.bind(this));
                this._video.on('timeupdate', this._onFrameUpdate.bind(this));
                this._video.on('loadeddata', onCanPlay.bind(this));
                this._video.on('ended', this._onCompleted.bind(this));
                callback();
            });
            
        });

    }

    /**
     * 处理视频资源
     */
     private _updateVideoSource() {
        console.log("_updateVideoSource");
        if (this._source) {
            this._url = this._source;
        }
        if (this._clip) {
            this._url = this._clip.nativeUrl;
        }

        if (!this._url) return;

        this._nativeHeight = 0;
        this._nativeWidth = 0;
        this._pixelFormat = PixelFormat.NONE;
         this._currentState = VideoState.IDLE;
         let source = document.createElement('source');
         this._videojs.appendChild(source);
         this._video.pause();
         this._video.src({src : this._url, type: "video/mp4"});
         this._video.load();


        this.node.emit('preparing', this);
        EventHandler.emitEvents(this.videoPlayerEvent, this, EventType.PREPARING);
    }

    /**
     * 播放视频
     */
     public play() {
        if (this._isInPlaybackState()) {
            if (this._currentState == VideoState.COMPLETED) {
                this.currentTime = 0;
            }
            if (this._currentState != VideoState.PLAYING) {
                if (this._volume !== -1) {
                    this.setVolume(this._volume);
                    this._volume = -1;
                }

                this._video.play();

                this.node.emit('playing', this);
                this._currentState = VideoState.PLAYING;
                this._targetState = VideoState.PLAYING;
                EventHandler.emitEvents(this.videoPlayerEvent, this, EventType.PLAYING);
            }
        } else {
            this._targetState = VideoState.PLAYING;
        }
    }

    private _onReadyToPlay() {
        console.log("_onReadyToPlay");
        this._updatePixelFormat();
        this._currentState = VideoState.PREPARED;
        if (this._seekTime > 0.1) {
            this.currentTime = this._seekTime;
        }
        this._updateTexture();
        this.node.emit('ready', this);
        EventHandler.emitEvents(this.videoPlayerEvent, this, EventType.READY);
        this._targetState == VideoState.PLAYING && this.play();
    }
    /**
     * 每帧回调
     * @returns 
     */
    private _onFrameUpdate() {
        console.log("_onFrameUpdate");
        if (this._isInPlaybackState()) {
            this._updatePixelFormatInMaterial();
        }
    }

    private _onCompleted() {
        console.log("_onCompleted");
    }

    @property(Renderer)
    public render: Renderer = null;

    /**
 * 重置贴图状态
 * @param texture 贴图
 * @param width 宽
 * @param height 高
 */
    private _resetTexture(texture: Texture2D, width: number, height: number, format?: number) {
        texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
        texture.setMipFilter(Texture2D.Filter.LINEAR);
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);

        texture.reset({
            width: width,
            height: height,
            //@ts-ignore
            format: format ? format : gfx.Format.RGB8
        });
    }

    get width(): number {
        if (!this._isInPlaybackState()) return 0;
        if (this._nativeWidth > 0) return this._nativeWidth;

        this._nativeWidth = this._video.videoWidth();
        return this._nativeWidth;
    }

    get height(): number {
        if (!this._isInPlaybackState()) return 0;
        if (this._nativeHeight > 0) return this._nativeHeight;

        this._nativeHeight = this._video.videoHeight();

        return this._nativeHeight;
    }

    /**
 * 更新贴图
 */
    private _updateTexture() {
        if (this.render instanceof Sprite) {
            let sprite: Sprite = this.render;
            if (sprite.spriteFrame === null) {
                sprite.spriteFrame = new SpriteFrame();
            }
            let texture = new Texture2D();
            this._resetTexture(texture, this.width, this.height);
            sprite.spriteFrame.texture = texture;
        }
        this._texture0 = new Texture2D();
        this._texture1 = new Texture2D();
        this._texture2 = new Texture2D();
        this._resetTexture(this._texture0, this.width, this.height);
        switch (this._pixelFormat) {
            case PixelFormat.I420:
                this._resetTexture(this._texture1, this.width >> 1, this.height >> 1);
                this._resetTexture(this._texture2, this.width >> 1, this.height >> 1);
                break;
            // fall through
            case PixelFormat.NV12:
            case PixelFormat.NV21:
                this._resetTexture(this._texture1, this.width >> 1, this.height >> 1, gfx.Format.RG8);
                break;
        }
        // if (JSB) this._video.updateTextureData(this._texture0, this._texture1, this._texture2);  
        this._updateMaterial();
    }

        /**
     * 更新材质
     */
         protected _updateMaterial(): void {
            let material = this.render.getMaterial(0);
            if (material) {
                material.setProperty('texture0', this._texture0);
                switch (this._pixelFormat) {
                    case PixelFormat.I420:
                        material.setProperty('texture2', this._texture2);
                    // fall through
                    case PixelFormat.NV12:
                    case PixelFormat.NV21:
                        material.setProperty('texture1', this._texture1);
                        break;
                }
            }
        }

    private _updatePixelFormatInMaterial():void {
        let material: Material = this.render.getMaterial(0);
        if (material.getProperty('pixelFormat') !== this._pixelFormat) {
            material.setProperty('pixelFormat', this._pixelFormat);
        }
    }

    private _loadScriptAsynWithParam(url: string, callback: Function) {
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.onload = function () {
            callback(0, "loadScript " + url + " success");
        };

        script.charset = "utf-8";
        script.src = url;
        document.body.appendChild(script);
    }

    // current position of the video which is playing
    get currentTime() {
        if (!this._video) return 0;
        if (this._isInPlaybackState()) {
                return this._video.currentTime();
        } else {
            return this._seekTime;
        }
    }
    /**
 * 设置音量
 * @param volume 音量 0-1
 * @returns 
 */
    public setVolume(volume) {
        if (!this._isInPlaybackState()) {
            this._volume = volume;
            return;
        }

        this._video.volume(volume);

    }
    // seek to position
    set currentTime(value: number) {
        if (!this._video) return;
        if (this._isInPlaybackState()) {
                this._video.currentTime(value);
        } else {
            this._seekTime = value;
        }
    }

        /**
     * 更新像素格式
     * @returns 
     */
         private _updatePixelFormat(): void {
            let index: number = this.render instanceof Sprite ? 1 : 0; 
            let pixelFormat = PixelFormat.RGB;
            if (this._pixelFormat == pixelFormat) return;
            this._pixelFormat = pixelFormat;
            let material: Material = new Material();
            material.copy(this.materials[index]);
            this.render.setMaterial(material, 0);
            this.render.customMaterial = material;
            this.render.getMaterial(0).setProperty('chromaKey', this.removeGreenScreen ? 1 : 0);
            this.render.getMaterial(0).setProperty('pixelFormat', PixelFormat.NONE);
        }
    private _isInPlaybackState() {
        return !!this._video && this._currentState != VideoState.IDLE && this._currentState != VideoState.PREPARING && this._currentState != VideoState.ERROR;
    }
}

