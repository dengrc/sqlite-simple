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
	db.list.bulkInsert(Array.from(new Array(3),function(a,i){
		return {
			code:d+i,
			name:d+i
		}
	}))
	
	db.list.select(["code","name"]).then(function(e){
		console.log(e)
	});
})
