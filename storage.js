var path = require('path')
    ,mime = require('mime')
    ,fs = require('fs')
    ,gm = require('gm');
var storage = {
    getRootPath: function(){
        return JSON.parse(fs.readFileSync('config/main.json')).root_path;
    },
    newFolder: function(file_path, callback){
        var real_path = path.join(storage.getRootPath(), file_path);
        var folder_name = '新建文件夹';
        var i = 0;
        while (fs.existsSync(path.join(real_path, folder_name))) {
            folder_name = '新建文件夹' + (++i);
        }
        fs.mkdir(path.join(real_path, folder_name), 0777, function(err){
            var date = storage.dateFormat('y-m-d h:i');
            if (err) {
                callback(err, null);
            } else {
                callback(null, {
                    "name": folder_name,
                    "type": 'folder',
                    "size": 0,
                    "ctime": date,
                    "mtime": date
                });
            }
        });
    },
    dir: function(body, callback) {
        var real_path = path.join(storage.getRootPath(), body.path);
        fs.readdir(real_path, function(err, files){
            if (files != undefined) {
                var list = [];
                var c = files.length != undefined ? files.length : 0;
                for (var i=0; i<c; i++) {
                    //关键字鉴别
                    if (body.keyword != '' && files[i].indexOf(body.keyword) == -1) {
                        continue;
                    }
                    var file_path = path.join(real_path, files[i]);
                    var stat = fs.statSync(file_path)
                    var type = 'folder';
                    var size = 0;
                    if (stat.isFile()) {
                        type = mime.lookup(file_path);
                        size = stat.size;
                    }
                    //类型鉴别
                    if (body.type == 'folder' && type != 'folder')
                        continue;
                    if (body.type == 'image' && ['image/jpeg','image/png','image/gif','image/bmp'].indexOf(type) == -1)
                        continue;
                    //返回数据
                    list.push({
                        "name": files[i],
                        "type": type,
                        "size": storage.sizeFormat(type, size),
                        "ctime": storage.dateFormat('y-m-d h:i', stat.ctime),
                        "mtime": storage.dateFormat('y-m-d h:i', stat.mtime)
                    });
                    //排序
                    switch (parseInt(body.sort)) {
                        case 1:
                            list.sort().reverse();
                            break;
                        case 2:
                            list.sort(function(a, b){
                                return a.size - b.size;
                            });
                            break;
                        case 3:
                            list.sort(function(a, b){
                                return b.size - a.size;
                            });
                            break;
                        case 4:
                            list.sort(function(a, b){
                                return a.mtime - b.mtime;
                            });
                            break;
                        case 5:
                            list.sort(function(a, b){
                                return b.mtime - a.mtime;
                            });
                            break;
                    }
                }
                callback(list);
            } else {
                callback(null, '网盘配置错误：路径不存在');
            }
        });
    },
    rename: function(body, callback){
        var root_path = storage.getRootPath();
        fs.rename(path.join(root_path, body.file_name),
            path.join(root_path, body.new_name),
            function(err){
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, '重命名成功');
                }
            }
        );
    },
    move: function(body, callback){
        var root_path = storage.getRootPath();
        old_file = path.join(root_path, body.path, body.file_name);
        new_file = path.join(root_path, body.new_path, body.file_name);
        var is = fs.createReadStream(old_file);
        var os = fs.createWriteStream(new_file);
        is.pipe(os);
        fs.unlinkSync(old_file);
        callback('移动成功');
    },
    remove: function(file_path, callback){
        var real_path = path.join(storage.getRootPath(), file_path);
        if (fs.existsSync(real_path)) {
            var stat = fs.statSync(real_path);
            if (stat.isDirectory()) {
                fs.rmdir(real_path, function(err){
                    if (err) {
                        callback('删除文件夹失败，如果文件夹中有文件，需要先删除', null);
                    } else {
                        callback(null, '删除文件夹成功');
                    }
                });
            } else if (stat.isFile()) {
                fs.unlink(real_path, function(err){
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, '删除文件成功');
                    }
                });
            }
        } else {
            callback('文件不存在', null);
        }
    },
    info: function(file_path, callback){
        var real_path = path.join(storage.getRootPath(), file_path);
        fs.stat(real_path, function(err, stat){
            if (err) {
                callback(err, null);
            } else {
                callback(null, {
                    "mime": mime.lookup(real_path),
                    "full_path": real_path,
                    "size": stat.size,
                    "ctime": stat.size/1000,
                    "mtime": stat.mtime/1000
                });
            }
        });
    },
    sizeFormat: function(type, size){
        if (type != 'folder') {
            var unit = [' G',' M',' kb',' byte']
            while (size > 1024) {
                size /= 1024;
                unit.pop();
            }
            return size.toFixed(2) + unit.pop();
        } else {
            return '-';
        }
    },
    dateFormat: function(format, time){
        var date;
        if (time != undefined)
            date = new Date(time);
        else
            date = new Date();
        var date_dict = {
            'y': date.getFullYear(),
            'm': date.getMonth() + 1,
            'd': date.getDate(),
            'h': date.getHours(),
            'i': date.getMinutes(),
            's': date.getSeconds()
        }
        if (format == undefined)
            format = 'y-m-d h:i:s';
        var date_str = '';
        for(var i=0; i<format.length; i++) {
            var s = format.charAt(i);
            if (date_dict[s]) {
                date_str += date_dict[s] < 10 ? '0'+date_dict[s] : date_dict[s];
            } else {
                date_str += s;
            }  
        }
        return date_str;
    },
    image: function(file_path, width, height, callback){
        var real_path = path.join(storage.getRootPath(), decodeURI(file_path));
        if (fs.existsSync(real_path)) {
            if (width != undefined || height != undefined) {
                var thumb_path = JSON.parse(fs.readFileSync('config/main.json')).thumb_path;
                var paths = real_path.split('/');
                var file_name = paths[paths.length-1];
                var cache_name = thumb_path+width+'_'+height+'_'+file_name;
                if (fs.existsSync(cache_name)) {
                    fs.readFile(cache_name, function(err, data){
                        if (err) {
                            callback(err.toString());
                        } else {
                            callback(null, data, mime.lookup(cache_name));
                        }
                    });
                } else {
                    gm(real_path).resize(width, height)
                    .autoOrient()
                    .write(cache_name, function(err){
                        if (err) {
                            callback(err);
                        } else {
                            fs.readFile(cache_name, function(err, data){
                                if (err) {
                                    callback(err.toString());
                                } else {
                                    callback(null, data, mime.lookup(cache_name));
                                }
                            });
                        }
                    });
                }
            } else {
                fs.readFile(real_path, function(err, data){
                    if (err) {
                        callback(err.toString());
                    } else {
                        callback(null, data, mime.lookup(real_path));
                    }
                });
            }
        } else {
            callback('文件不存在');
        }
    }
};
exports.storage = storage;