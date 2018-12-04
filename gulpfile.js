//参考:https://blog.csdn.net/cczhumin/article/details/50990726
//https://github.com/babyzone2004/cocosMd5/blob/master/gulpfile.js

var gulp = require('gulp');
var minimist = require('minimist');
var uglify = require('gulp-uglify');
var minifyHtml = require('gulp-minify-html');
var minifyCss = require('gulp-minify-css');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var prefix = require('gulp-prefix');
var zip = require('gulp-zip');
var gulpSequence = require('gulp-sequence');
var fs = require('fs');
var revFormat = require('gulp-rev-format');
var clean = require('gulp-clean');

//============================================================================================
var BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
var BASE64_VALUES = new Array(123); // max char code in base64Keys
for (let i = 0; i < 123; ++i) BASE64_VALUES[i] = 64; // fill with placeholder('=') index
for (let i = 0; i < 64; ++i) BASE64_VALUES[BASE64_KEYS.charCodeAt(i)] = i;



var HexChars = '0123456789abcdef'.split('');

var _t = ['', '', '', ''];
var UuidTemplate = _t.concat(_t, '-', _t, '-', _t, '-', _t, '-', _t, _t, _t);
var Indices = UuidTemplate.map(function (x, i) { return x === '-' ? NaN : i; }).filter(isFinite);

// fcmR3XADNLgJ1ByKhqcC5Z -> fc991dd7-0033-4b80-9d41-c8a86a702e59
var  decodeUuid = function (base64) {
    if (base64.length !== 22) {
        return base64;
    }
    UuidTemplate[0] = base64[0];
    UuidTemplate[1] = base64[1];
    for (var i = 2, j = 2; i < 22; i += 2) {
        var lhs = BASE64_VALUES[base64.charCodeAt(i)];
        var rhs = BASE64_VALUES[base64.charCodeAt(i + 1)];
        UuidTemplate[Indices[j++]] = HexChars[lhs >> 2];
        UuidTemplate[Indices[j++]] = HexChars[((lhs & 3) << 2) | rhs >> 4];
        UuidTemplate[Indices[j++]] = HexChars[rhs & 0xF];
    }
    return UuidTemplate.join('');
};
//============================================================================================

//清理文件
gulp.task('clean', function () {
    return gulp.src('./build/web-mobile_dist/', {read: false})
        .pipe(clean());
});


//拷贝自定义数据
gulp.task('copy', function(cb) {
    gulp.src(['./build/web-mobile/**', './html/*.*'])
    .pipe(gulp.dest('./build/web-mobile_dist/')
    .on('end', cb));
});

//对main.js进行特殊处理
gulp.task("salt", function(cb){
    var data = fs.readFileSync('./build/web-mobile_dist/main.js', 'utf8');
    var salt = (new Date()).valueOf().toString();
    var newData =   data + "//salt" + salt + "\n"; 
    fs.writeFileSync('./build/web-mobile_dist/main.js', newData)
    cb();
});

//资源md5
gulp.task('md5_res',function(cb){
    gulp.src('./build/web-mobile_dist/res/raw-assets/*/*.*') .pipe(rev())
    .pipe(revFormat({
        prefix: '.',
        suffix: '',
        lastExt: false
    }))
    .pipe(gulp.dest('./build/web-mobile_dist/res/raw-assets/'))
    .pipe(rev.manifest())
    .pipe(gulp.dest('./build/web-mobile_dist/res/raw-assets/')
    .on('end', cb));
});

gulp.task('md5_src',function(cb){
    gulp.src(['./build/web-mobile_dist/**/*.js', './build/web-mobile_dist/*.png', './build/web-mobile_dist/*.css'])
    .pipe(rev())
    .pipe(gulp.dest('./build/web-mobile_dist/'))
    .pipe(rev.manifest())
    .pipe(gulp.dest('./build/web-mobile_dist/').on('end', cb));

});

gulp.task('htmlmin',function(cb){
    return gulp.src("./build/web-mobile_dist/*.html")
    .pipe(minifyHtml())
    .pipe(gulp.dest('./build/web-mobile_dist/'));
})

gulp.task('jsmin',function(cb){
    return gulp.src("./build/web-mobile_dist/**/*.js")
    .pipe(uglify())
    .pipe(gulp.dest('./build/web-mobile_dist/'));
 })

gulp.task('cssmin',function(cb){
    return gulp.src("./build/web-mobile_dist/*.css")
    .pipe(minifyCss())
    .pipe(gulp.dest('./build/web-mobile_dist/'));
})

//生成新的配置表
gulp.task("setting", function(cb){
    console.log("生成新的配置"); 
   
    var data = fs.readFileSync('./build/web-mobile_dist/res/raw-assets/rev-manifest.json', 'utf8');
    var  rev_manifest = JSON.parse( data ); 
    
    //做一下中间处理
    var rev_manifest_map = {}
    for(key in rev_manifest)
    {
        rev_manifest_map[key.substr(3, 36)] = key;
    }
 

    var window = {}
    var settingCode = fs.readFileSync('./build/web-mobile_dist/src/settings.js', 'utf8');   
    eval(settingCode)
    
    var rawAssets = window._CCSettings.rawAssets.assets
    window._CCSettings.rawAssets.assets = {}
    window._CCSettings.md5AssetsMap["raw-assets"] = []

    for(tmp in rawAssets)
    {
       
        var uuid = decodeUuid(tmp);
        if(uuid === tmp)
        {
            window._CCSettings.rawAssets.assets[uuid] = rawAssets[tmp]

            let true_uuid = decodeUuid(window._CCSettings.uuids[ parseInt(uuid)  ])
            if( rev_manifest_map.hasOwnProperty(true_uuid)  )
            {
                var oldName = rev_manifest_map[true_uuid];
                var newName = rev_manifest[oldName];
                
                //会不会有没有后缀名的文件啊？
                var oldFileName = oldName.substr(0, oldName.lastIndexOf(".")) 
                var newFileName = newName.substr(0, newName.lastIndexOf("."))  
               
                var md5Str = newFileName.substr(oldFileName.length + 1, newFileName.length - oldFileName.length )
                
                
                window._CCSettings.md5AssetsMap["raw-assets"].push(parseInt(uuid))
                window._CCSettings.md5AssetsMap["raw-assets"].push(md5Str) 
            }

        }else{           
            window._CCSettings.uuids.push(tmp)
            window._CCSettings.rawAssets.assets[window._CCSettings.uuids.length - 1] = rawAssets[tmp]
        }
      

        
    }



    //旧的packedAssets
    var packedAssets = window._CCSettings['packedAssets'];
    window._CCSettings.packedAssets = {};
    
    window._CCSettings.md5AssetsMap.import = []
 
    for(key in packedAssets)
    {
       var assertList =  packedAssets[key];
       var tmp  = [];

        for(i = 0,len=assertList.length; i < len; i++) {
            var hashCode = assertList[i];
            var uuid = decodeUuid(hashCode);
            //查找相应的列表
            if( rev_manifest_map.hasOwnProperty(uuid)  )
            {
                var oldName = rev_manifest_map[uuid];
                var newName = rev_manifest[oldName];
                
                //会不会有没有后缀名的文件啊？
                var oldFileName = oldName.substr(0, oldName.lastIndexOf(".")) 
                var newFileName = newName.substr(0, newName.lastIndexOf("."))  
               
                var md5Str = newFileName.substr(oldFileName.length + 1, newFileName.length - oldFileName.length )
                
                
                window._CCSettings.uuids.push(hashCode)
                tmp.push(window._CCSettings.uuids.length - 1) 
                
                window._CCSettings.md5AssetsMap["raw-assets"].push(window._CCSettings.uuids.length - 1)
                window._CCSettings.md5AssetsMap["raw-assets"].push(md5Str) 
            }else{
                tmp.push(  hashCode );  
            }            
        }
       
        window._CCSettings.md5AssetsMap.import.push(key)
        window._CCSettings.md5AssetsMap.import.push("") //这个值不知道干啥用的
        window._CCSettings.packedAssets[key] = tmp;
      
    }

   


    // console.log( window._CCSettings)
    var outStr =  "window._CCSettings = JSON.parse('" + JSON.stringify( window._CCSettings) + "')"  + '; (function(e) { var t = e.uuids,i = e.md5AssetsMap;for (var s in i) for (var r = i[s], n = 0; n < r.length; n += 2)"number" == typeof r[n] && (r[n] = t[r[n]])})(window._CCSettings);'
    fs.writeFileSync  ('./build/web-mobile_dist/src/settings.js', outStr,'utf8');
    cb();
})


//替换资源文件名
gulp.task("rep" ,function(cb){
    var manifest = gulp.src( "./build/web-mobile_dist/rev-manifest.json");
 
    return gulp.src(["./build/web-mobile_dist/index.html", 
    "./build/web-mobile_dist/*.js",
    "./build/web-mobile_dist/*.css",  
    ])
    .pipe(revReplace({manifest: manifest}))
    .pipe(gulp.dest('./build/web-mobile_dist/' ));
});

//清理掉加版本前的文件

gulp.task("rm_unuser" ,function(cb){
    //图片资源
    var data = fs.readFileSync('./build/web-mobile_dist/res/raw-assets/rev-manifest.json', 'utf8');
    var  rev_manifest = JSON.parse( data ); 
    for(key in rev_manifest)
    {
        fs.unlinkSync('./build/web-mobile_dist/res/raw-assets/' + key);
    }
    fs.unlinkSync('./build/web-mobile_dist/res/raw-assets/rev-manifest.json');
    //根目录资源
    var data = fs.readFileSync('./build/web-mobile_dist/rev-manifest.json', 'utf8');
    var  rev_manifest = JSON.parse( data ); 
    for(key in rev_manifest)
    {
        fs.unlinkSync('./build/web-mobile_dist/' + key);
    }
    fs.unlinkSync('./build/web-mobile_dist/rev-manifest.json');
     //清除文件的时候，如果遇到比较大的话，可能还没有删除完就已经进入了下一步
     setTimeout(function() {
        cb();        
    }, 500)   
});

gulp.task('default', function(cb) {
    // 将你的默认的任务代码放在这
    gulpSequence('clean', 'copy',"salt",'md5_res','setting','md5_src', "rep","rm_unuser", 'htmlmin','jsmin',  'cssmin'  ,cb)

});