const sqlite3 = require('sqlite3').verbose()

function mixin(a, b) {
	for(let k in b) {
		a[k] = b[k]
	}
	return a
}

class sqliteDataBase {
	constructor(filename, callback) {
		this.db = new sqlite3.Database(filename, e => callback(this));

		this._readyResolve;
		this._process = new Promise((resolve, reject) => this._readyResolve = resolve)
	}

	ready(fn) {
		return this._process.then(fn)
	}

	pushTable() {
		this._process = Promise.all(Array.from(arguments, table => {
			return new Promise((resolve, reject) => {
				let sql = "CREATE TABLE IF NOT EXISTS " + table.tableName + "(";
				const fields = [];

				for(let field in table.fields) {
					fields.push("[" + field + "] " + table.fields[field].join(" "))
				}

				if(Array.isArray(table.primaryKey)) {
					fields.push("PRIMARY KEY (" + table.primaryKey.join(",") + ")")
				}

				const _table = this[table.tableName] = new Table(this.db, table.tableName, table.fields, table.primaryKey, table.uniqueKey)
				this.db.run(sql + fields.join(",") + ")", undefined, () => resolve(_table))
			})
		})).then((e) => {
			this._readyResolve(this);
			return this
		});
		return this._process
	}

	transaction(callback, serialize) {
		const begin = () => {
				this.db.run("BEGIN TRANSACTION")
			},
			commit = () => {
				this.db.run("COMMIT TRANSACTION")
			},
			rollback = () => {
				this.db.run("ROLLBACK")
			};

		serialize ? this.db.serialize(() => callback(begin, commit, rollback)) : callback(begin, commit, rollback)
	}
}

class Table {
	constructor(db, tableName, fields, primaryKey, uniqueKey) {
		this.db = db;
		this.tableName = tableName;
		this.fields = fields;
		this.fieldsKeys = Object.keys(fields);
		this.primaryKey = primaryKey;
		this.uniqueKey = uniqueKey
	}

	_get_insert_params(data) {
		const fields = [],
			params = [];

		this.fieldsKeys.forEach(k => {
			if(k in data) {
				fields.push(k);
				params.push(data[k])
			}
		})

		return params.length ? {
			fields: fields,
			params: params
		} : null
	}

	_get_where_params(data, _uniqueKey, join) {
		const where = [],
			params = [],
			s = join ? " OR " : " AND ",
			uniqueKey = _uniqueKey || this.primaryKey;

		(Array.isArray(uniqueKey) ? uniqueKey : [uniqueKey]).forEach(key => {
			where.push(key + '=?');
			params.push(data[key])
		});

		return where.length ? {
			where: where.join(s),
			params: params
		} : null
	}

	_get_data_params(value) {
		return this._get_where_params(value, Object.keys(value))
	}

	_select(where, fields, type) {
		const sql = ['SELECT', fields ? fields.join(',') : '*', 'FROM', this.tableName],
			params = where && where.params || [];

		return new Promise((resolve, reject) => {
			if(where) {
				sql.push('WHERE', where.where)
			}
			if(type === "each") {
				const ary = [];
				this.db[type](sql.join(' '), params, (ERR, rst) => ERR ? reject(ERR) : ary.push(rst), (ERR, rst) => ERR ? reject(ERR) : resolve(ary))
			} else {
				this.db[type](sql.join(' '), params, (ERR, rst) => ERR ? reject(ERR) : resolve(rst))
			}
		})
	}

	_get(where, fields) {
		return this._select(where, fields, 'get')
	}

	_each(where, fields) {
		return this._select(where, fields, 'each')
	}

	get(value, fields) {
		return this._get(this._get_data_params(value), fields)
	}

	each(value, fields) {
		return this._each(this._get_data_params(value), fields)
	}

	select(fields) {
		return new Promise((resolve, reject) => this.db.all(['SELECT', fields ? fields.join(',') : '*', 'FROM', this.tableName].join(' '), (ERR, rst) => ERR ? reject(ERR) : resolve(rst)))
	}

	insert(data, isResult) {
		const p = this._get_insert_params(data);

		return new Promise((resolve, reject) => p ?
			this.db.run(['INSERT INTO', this.tableName, "(" + p.fields.join(',') + ") VALUES(?" + new Array(p.params.length).join(",?") + ")"].join(" "), p.params, ERR => ERR ? reject(ERR) : isResult ? this._get(this._get_where_params(data, this.uniqueKey)).then(resolve, reject) : resolve(this)) :
			reject())
	}

	delete(data) {
		const p = this._get_where_params(data);

		return new Promise((resolve, reject) => p ?
			this.db.run(['DELETE FROM', this.tableName, 'WHERE', p.where].join(" "), p.params, ERR => ERR ? reject(ERR) : resolve(this)) :
			reject())
	}

	update(data, isResult) {
		const p = this._get_insert_params(data),
			p2 = this._get_where_params(data);

		return new Promise((resolve, reject) => p && p2 ?
			this.db.run(['UPDATE', this.tableName, "SET", p.fields.join('=?,') + '=?', 'WHERE', p2.where].join(" "), p.params.concat(p2.params), ERR => ERR ? reject(ERR) : isResult ? this.get(p2).then(resolve, reject) : resolve(this)) :
			reject())
	}

	put(fields, data, dataHandler) {
		const p = this._get_where_params(data, fields);

		return new Promise((resolve, reject) => this._get(p).then(_data => {
			if(_data) {
				dataHandler && dataHandler(_data, data);
				mixin(_data, data);

				this.update(_data).then(() => resolve(_data), reject)
			} else {
				this.insert(data, true).then(resolve, reject)
			}
		}, reject))
	}

	bulkInsert(array, isResult) {
		return Promise.all(array.map(data => this.insert(data, isResult)))
	}

	bulkDelete(array) {
		return Promise.all(array.map(data => this.delete(data)))
	}

	bulkUpdate(array, isResult) {
		return Promise.all(array.map(data => this.update(data, isResult)))
	}

	bulkPut(fields, array, dataHandler) {
		return Promise.all(array.map(data => this.put(fields, data, dataHandler)))
	}
}

module.exports = sqliteDataBase