# sqlite-simple
## database
* pushTable([...options])
* ready()
* transaction(callback[, serialize])

## table
* insert(data[, isResult])
* delete(data)
* update(data[, isResult])
* select(fields='*')
* put(data[, fields][, dataHandler])
* bulkInsert(array[, isResult])
* bulkDelete(array)
* bulkUpdate(array[, isResult])
* bulkPut(array[, fields][, dataHandler])
* get(where[, fields])
* each(where[, fields])

###创建数据库、表
**注意：** 如果需要在 insert、put 操作后获取返回值添加 `uniqueKey`
```javascript
const DataBase = require('sqlite-simple');

const db=new DataBase("./a.db",function(db){
	db.pushTable({
		tableName: 'classify',
		fields: {
			"id": ["integer", "autoincrement"],
			"name": ["text", "NOT NULL"]
		},
		primaryKey: ["id"]
	},{
		tableName:'list',
		fields: {
			"id": ["integer", "autoincrement"],
			"title": ["text", "NOT NULL"],
			"content":["text", "NOT NULL"]//, "UNIQUE" ,"DEFAULT(...)"
		},
		primaryKey: ["id"],
		//如果需要在 insert、put 操作后获取返回值添加这个配置
		uniqueKey: ["title"]
		/* CREATE TABLE IF NOT EXISTS ${tableName}(
		 * for(field in fields)
		 * [${field}] ${fields[field].join(" ")}
		 * 
		 * PRIMARY KEY(${primaryKey})
		 * )
		 */
	})
});
```

###bulkInsert
**注意：** 数据库是异步创建，如果要立即操作数据, 加 `ready`
```javascript
db.ready().then(function(db){
	db.list.bulkInsert([
		{
			title:"标题1",
			content:"内容1"
		},
		{
			title:"标题2",
			content:"内容2"
		}
	]).then(function(e){
		console.log(e)
	}).catch(function(e){
		console.error(e)
	})
})
```

###select
**注意：** 对应 `sqlite3` 中的  [db.all](https://github.com/mapbox/node-sqlite3/wiki/API#databaseallsql-param--callback)
```javascript
//所有字段
db.list.select().then(function(result){
	console.log(result)
}).catch(function(e){
	console.error(e)
})
//部分字段
db.list.select(["code","name"]).then(function(result){
	console.log(result)
}).catch(function(e){
	console.error(e)
})
//部分字段
db.list.select("code,name").then(function(result){
	console.log(result)
}).catch(function(e){
	console.error(e)
})
```