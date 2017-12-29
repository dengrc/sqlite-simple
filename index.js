function defineProperties(obj, props) {
	for(var k in props) {
		Object.defineProperty(obj, k, {
			value: props[k]
		})
	}
}

function mixin(a, b) {
	for(var k in b) {
		a[k] = b[k]
	}
	return a;
}

const sqliteDataBase = function(sqlite3, filename, callback) {
	var _this = this;

	_this.db = new sqlite3.Database(filename, function(e) {
		callback(_this)
	})
}
//DataBase.prototype={};
defineProperties(sqliteDataBase.prototype, {
	pushTable: function() {
		Array.prototype.slice.call(arguments).forEach(function(table) {
			var sql = "CREATE TABLE IF NOT EXISTS " + table.tableName + "(",
				fields = [];

			for(var field in table.fields) {
				fields.push("[" + field + "] " + table.fields[field].join(" "));
			}

			if(Array.isArray(table.primaryKey)) {
				fields.push("PRIMARY KEY (" + table.primaryKey.join(",") + ")")
			}

			this.db.run(sql + fields.join(",") + ")");
			this[table.tableName] = new Table(this.db, table.tableName, table.fields, table.primaryKey, table.uniqueKey);
		}, this);
	},
	transaction: function(callback, serialize) {
		var db = this.db,
			begin = function() {
				db.run("BEGIN TRANSACTION");
			},
			commit = function() {
				db.run("COMMIT TRANSACTION");
			},
			rollback=function(){
				db.run("ROLLBACK")
			};
		//this.db.run("BEGIN TRANSACTION");
		serialize ? this.db.serialize(function() {
			callback(begin, commit,rollback)
		}) : callback(begin, commit,rollback);
		//this.db.run("COMMIT TRANSACTION");
	}
});

const Table = function(db, tableName, fields, primaryKey,uniqueKey) {
	this.db = db;
	this.tableName = tableName;
	this.fields = fields;
	this.primaryKey = primaryKey;
	this.uniqueKey=uniqueKey;
}

defineProperties(Table.prototype, {
	get_insert_params: function(data) {
		var fields = [],
			params = [];
		for(var k in this.fields) {
			if(k in data) {
				fields.push(k);
				params.push(data[k]);
			}
		}
		return params.length ? {
			fields: fields,
			params: params
		} : null
	},
	get_item_params: function(data,_uniqueKey,join) {
		var where = [],
			params = [],
			s=join?" OR ":" AND ",
			uniqueKey=_uniqueKey||this.primaryKey;

		(Array.isArray(uniqueKey) ? uniqueKey : [uniqueKey]).forEach(function(key) {
			where.push(key + '=?');
			params.push(data[key])
		});

		return where.length ? {
			where: where.join(s),
			params: params
		} : null
	},
	get_data_params:function(value){
		var k,keys=[];
		for(k in value){
			keys.push(k)
		}
		return this.get_item_params(value,keys)
	},
	_select:function(where,fields,type){
		var sql = ['SELECT', fields ? fields.join(',') : '*', 'FROM', this.tableName];
		var _this = this;
		var params=where&&where.params||[];
		return new Promise(function(resolve, reject) {
			if(where) {
				sql.push('WHERE', where.where);
			}
			if(type==="each"){
				var ary=[];
				_this.db[type](sql.join(' '), params, function(ERR, rst) {
					ERR ? reject(ERR) : ary.push(rst)
				}, function(ERR, rst) {
					ERR ? reject(ERR) : resolve(ary)
				})
			}else{
				_this.db[type](sql.join(' '), params, function(ERR, rst) {
					ERR ? reject(ERR) : resolve(rst)
				})
			}
		})
	},
	_get:function(where,fields){
		return this._select(where,fields,'get')
	},
	_each:function(where,fields){
		return this._select(where,fields,'each')
	},
	get:function(value,key){
		return this._get(this.get_data_params(value));
	},
	each:function(value,key){
		return this._each(this.get_data_params(value));
	},
	select: function(fields) {
		var _this = this;
		return new Promise(function(resolve, reject) {
			_this.db.all(['SELECT', fields ? fields.join(',') : '*', 'FROM', _this.tableName].join(' '), function(ERR, rst) {
				ERR ? reject(ERR) : resolve(rst)
			})
		})
	},
	insert: function(data,isResult) {
		var p = this.get_insert_params(data);
		var _this = this;
		return new Promise(function(resolve, reject) {
			if(p) {
				_this.db.run(['INSERT INTO', _this.tableName, "(" + p.fields.join(',') + ") VALUES(?" + new Array(p.params.length).join(",?") + ")"].join(" "), p.params, function(ERR) {
					ERR ? reject(ERR) :isResult?_this._get(_this.get_item_params(data,_this.uniqueKey)).then(resolve,reject): resolve(this)
				})
			} else {
				reject()
			}
		})
	},
	delete: function(data) {
		var p = this.get_item_params(data);
		var _this = this;
		return new Promise(function(resolve, reject) {
			if(p) {
				_this.db.run(['DELETE FROM', _this.tableName, 'WHERE', p.where].join(" "), p.params, function(ERR) {
					ERR ? reject(ERR) : resolve(this)
				})
			} else {
				reject()
			}
		})
	},
	update: function(data,isResult) {
		var p = this.get_insert_params(data),
			p2 = this.get_item_params(data);
		var _this = this;
		return new Promise(function(resolve, reject) {
			if(p && p2) {
				_this.db.run(['UPDATE', _this.tableName, "SET", p.fields.join('=?,') + '=?', 'WHERE', p2.where].join(" "), p.params.concat(p2.params), function(ERR) {
					ERR ? reject(ERR) :isResult?_this.get(p2).then(resolve,reject): resolve(this)
				})
			} else {
				reject()
			}
		})
	},
	put: function(fields, data,dataHandler) {
		var _this = this,
		p=this.get_item_params(data,fields);

		return new Promise(function(resolve, reject) {
			_this._get(p).then(function(_data) {
				if(_data) {
					dataHandler&&dataHandler(_data,data);
					mixin(_data, data);
					//fields.forEach(function(field) {
					//	delete _data[field]
					//});
					_this.update(_data).then(function(){
						resolve(_data)
					}, reject)
				} else {
					_this.insert(data,true).then(resolve, reject)
				}
			}, function(ERR) {
				reject(ERR)
			})
		})
	},
	bulkInsert: function(array) {

	},
	bulkDelete: function(array) {

	},
	bulkUpdate: function(array) {

	},
	bulkPut: function(fields, array,dataHandler) {
		var defs=[];
		array.forEach(function(data) {
			defs.push(this.put(fields, data,dataHandler))
		}, this)
		return Promise.all(defs)
	}
})

module.exports = sqliteDataBase;