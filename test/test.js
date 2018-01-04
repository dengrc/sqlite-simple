const DataBase = require('../index.js');

var db=new DataBase("./a.db",function(db){
	db.pushTable({
		tableName: 'list',
		fields: {
			"code": ["text"],
			"name": ["text"]
		},
		primaryKey: ["code"]
	})
});

db.ready().then(function(db){
	var d=Date.now();
	db.list.bulkInsert(Array.from(new Array(3),function(a,i){
		return {
			code:d+i,
			name:d+i
		}
	}))
	
//	db.list.select().then(function(e){
//		console.log(e)
//	});
})
