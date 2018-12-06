const DataBase = require('../index.js');
const sqlite3 = require('sqlite3').verbose()

//var db=new DataBase("./a.db",function(db){
//	db.pushTable({
//		tableName: 'list',
//		fields: {
//			"code": ["text"],
//			"name": ["text"]
//		},
//		primaryKey: ["code"]
//	})
//});

//db.ready().then(function(db){
	var d= new sqlite3.Database('./a.db', function(){
		
	});
	setTimeout(()=>{
		let v="');'"
		d.exec(`INSERT INTO list (code,name) VALUES(${v},4)`,function(){
			console.log(arguments)
		},function(){
			console.log(arguments)
		})
	},500)
//	let d=new Date();
//	db.list.bulkInsert(Array.from(new Array(3),function(a,i){
//		return {
//			code:d+i,
//			name:d+i
//		}
//	}))
//	
//	db.list.select(["code","name"]).then(function(e){
//		console.log(e)
//	});
//})
