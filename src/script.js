const { invoke } = window.__TAURI__.tauri;

var USERNAME = "",
    PASSWORD = "",
    SERVER = "",
    PORT = "",
    DB = "",
    STATUS = false;

var table_to_add_field = null,
    current_to_delete = null;

var FIELDS_DATA_TYPES = [
    "int",
    "text",
    "bool",
    "timestamptz",
    "serial",
    "real",
    "varchar(15)",
    "varchar(30)",
    "varchar(60)",
    "smallint",
    "bigint"
];

function qS(selector, node=null, all=false) {
    if (node == null) node = document;

    if (all)
	return node.querySelectorAll(selector);
    
    return node.querySelector(selector);
}

function create(elementName, attrs={}, classes=[], inner="") {
    let result = document.createElement(elementName);

    if (attrs != {}) {
	for (let key in attrs) {
	    result.setAttribute(key, attrs[key]);
	}
    }

    for (let className of classes) {
	result.classList.add(className);
    }

    if (inner.length > 0) result.innerText = inner;

    return result;
}

function addCh(node, elements) {
    for (let el of elements) {
	node.append(el);
    }
}

async function getColumns(tableName) {
    let response = await invoke("get_columns", {
	"tableName": tableName,
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    });

    let result = JSON.parse(response);

    //console.log("columns ->", result);
    console.log("COLUMNS OF " + tableName);
    console.log(result);

    let fields_list = qS(".fields .list");
    
    fields_list.innerHTML = '';

    for (let row of result.values) {
	let list_el = create("div", {}, ["list-el"]),
	    list_el_fname = create("div", {}, ["list-el-point", "fname"], row[0]),
	    list_el_ftype = create("div", {}, ["list-el-point", "ftype"], row[1]),
	    list_el_fnull = create("div", {}, ["list-el-point", "fnull"], row[2]),
	    list_el_fdfvalue = create("div", {}, ["list-el-point", "fdfvalue"], row[3]);
	//list_el_uniq = create("div", {}, ["list-el-point", "funiq"], row[0]),

	list_el.onclick = (e) => {
	    let columnName = row[0];
	    qS(".tools-object-short-description").innerHTML = `Таблица: <u>${tableName}</u> Столбец: <u>${columnName}</u>`;
	    current_to_delete = ["column", columnName, tableName];
	}

	addCh(list_el, [list_el_fname, list_el_ftype, list_el_fnull, list_el_fdfvalue]);
	addCh(fields_list, [list_el]);
    }
}

async function getTables() {
    let response = await invoke("get_tables", {
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    });

    let result = JSON.parse(response)

    let table_list = qS(".tables .list");

    table_list.innerHTML = '';

    for (let row of result.values) {
	let list_el = create("div", {}, ["list-el"]),
	    list_el_point = create("div", {}, ["list-el-point"], row[0]);

	list_el_point.onclick = (e) => {
	    let tableName = e.target.innerText.trim();

	    if (tableName.length == 0) return;

	    qS(".tools-object-short-description").innerHTML = `Таблица: <u>${tableName}</u>`;

	    let tools_add_field = qS(".tools-add-field");

	    tools_add_field.style.opacity = "1";
	    table_to_add_field = tableName;
	    tools_add_field.onclick = (e) => {
		if (table_to_add_field.length == 0) {
		    setMessage("Таблица не выбрана", error=true);
		    return;
		}
		qS(".create-field-window").style.display = "block";
	    }

	    let tools_delete = qS(".tools-delete");
	    tools_delete.style.opacity = "1";
	    current_to_delete = ["table", tableName, ''];
	    tools_delete.onclick = () => {
		let content = "Вы собираетесь ";
		if (current_to_delete[0] == "table")
		    content += "удалить таблицу <strong><u>" + current_to_delete[1] + "</u></strong> из базы данных <u>" + DB + "</u>.";
		else if (current_to_delete[0] == "column")
		    content += "удалить поле <strong><u>" + current_to_delete[1] + "</u></strong> из таблицы <u>" + current_to_delete[2]  + "</u> из базы данных <u>" + DB + "</u>.";

		qS(".module-window-content").innerHTML = content;
		qS(".submit-window").style.display = "block";
	    }

	    getColumns(tableName);
	}
	
	list_el.append(list_el_point);
	table_list.append(list_el);
    }
}

function setMessage(message, error=false) {
    let msg = create("div", {}, ["message", error ? "message-error" : "message-success"]),
	msg_title = create("div", {}, ["message-title"], error ? "Error" : "Success"),
	msg_content = create("div", {}, ["message-content"], message);

    msg.append(msg_title);
    msg.append(msg_content);
    qS(".message-container").append(msg);

    setTimeout(() => {
	msg.remove();
    }, 3000);
}

async function makeSqlRequest(sql) {
    sql = sql.replace('"', "'");
    invoke("sql_request", {
	"sql": sql,
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    })
	.then((value) => {
	    let result = JSON.parse(value);

	    if (result["result"] != undefined) {
		setMessage("Запрос выполнен");
		return;
	    }
	    
	    let sql_output = qS(".sql-output");
	    sql_output.innerHTML = '';

	    let column_width = 630 / result.fields.length;
	    
	    // display headers
	    let sql_output_name_fields = create("div", {}, ["sql-output-name-fieldsm", "sql-output-row"]);
	    sql_output_name_fields.append(
		    create("div", {"style": `width: 50px; max-width: 50px`}, ["sql-output-column"], "№")
		);
	    for (let column_name of result.fields) {
		sql_output_name_fields.append(
		    create("div", {"style": `width: ${column_width}px; max-width: ${column_width}px`}, ["sql-output-column"], column_name)
		);
	    }
	    sql_output.append(sql_output_name_fields);

	    // display rows
	    let row_number = 1;
	    for (let row of result.values) {
		
		let sql_output_row = create("div", {}, ["sql-output-row"]);
		sql_output_row.append(
		    create("div", {"style": `width: 50px; max-width: 50px`}, ["sql-output-column"], String(row_number))
		);
		row_number ++;
		
		for (let field of row) {
		    sql_output_row.append(
			create("div", {"style": `width: ${column_width}px; max-width: ${column_width}px`}, ["sql-output-column"], field)
		    );
		}
		sql_output.append(sql_output_row);
	    }

	    setMessage("Ваши данные на экране");
	})
	.catch((error) => {
	    let error_value = JSON.parse(error);
	    setMessage(error.result, error=true);
	});
}

async function checkConnection() {
    invoke("check_connection", {
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    }).then((value) => {
	console.log("checkConnection value:", value);
	
	let result = JSON.parse(value);

	if (result.result != "success") {
	    setMessage("Ошибка соединения. "+result.result, true);
	    return;
	}
	
	setMessage("Соединение установлено!");

	qS(".server-connect-window").remove();

	init();
	getTables();
	
    }).catch((error) => {
	setMessage("Ошибка соединения. "+error, true);
    });
}

async function createTable(tableName) {
    invoke("sql_request", {
	"sql": `CREATE TABLE IF NOT EXISTS ${tableName}();`,
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    }).then((value) => {
	console.log("create table:", value);
	
	let result = JSON.parse(value);

	if (result.result != "success") {
	    setMessage("Ошибка создания таблицы. "+result.result, true);
	    return;
	}

	qS(".create-table-window").style.display = "none";
	
	setMessage("Таблица \"" + tableName + "\" создана!");

	getTables();
	
    }).catch((error) => {
	console.log("ERROR (create table):", error);
	setMessage("Ошибка создания таблицы. "+error, true);
    });
}

async function createField() {
    let fieldname = qS("#input-fieldname").value,
	fieldtype = FIELDS_DATA_TYPES[qS("#input-fieldtype").value],
	fieldnull = qS("#input-fieldnull").checked,
	fieldunique = qS("#input-fieldunique").checked,
	fielddefault = qS("#input-fielddefault").value,
	fieldprimary = qS("#input-fieldprimary").checked;

    let sql = `ALTER TABLE ${table_to_add_field} ADD COLUMN ${fieldname} ${fieldtype}`;

    if (fieldnull) {
	sql += " NOT NULL";
    }

    if (fieldunique) {
	sql += " UNIQUE";
    }

    if (fieldprimary) {
	sql += " PRIMARY KEY";
    }

    if (fielddefault.length != '') {
	sql += ` DEFAULT ${fielddefault}`;
    }

    sql += ";"

    console.log("SQL", sql);

    invoke("sql_request", {
	"sql": sql,
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    }).then((value) => {
	console.log("create field:", value);
	
	let result = JSON.parse(value);

	if (result.result != "success") {
	    setMessage("Ошибка создания поля. "+result.result, true);
	    return;
	}

	qS("#input-fieldname").value = '';
	qS("#input-fieldtype").value = 0;
	qS("#input-fieldnull").checked = false,
	qS("#input-fieldunique").checked = false,
	qS("#input-fielddefault").value = '',
	qS("#input-fieldprimary").checked = false;
	
	qS(".create-field-window").style.display = "none";
	
	setMessage("Поле \"" + table_to_add_field + "\" в таблице \"" + fieldname + "\" создано!");

	getColumns(table_to_add_field);
	
    }).catch((error) => {
	console.log("ERROR (create field):", error);
	setMessage("Ошибка создания поля. "+error, true);
    });
}

async function deleteItem() {
    let sql = '';

    if (current_to_delete[0] == "column") {
	sql = `ALTER TABLE ${current_to_delete[2]} DROP COLUMN ${current_to_delete[1]};`;
    } else if (current_to_delete[0] == "table") {
	sql = `DROP TABLE ${current_to_delete[1]};`;
    }
    
    invoke("sql_request", {
	"sql": sql,
	"username": USERNAME,
	"password": PASSWORD,
	"server": SERVER,
	"port": PORT,
	"table": DB
    }).then((value) => {
	let result = JSON.parse(value);

	if (result.result != "success") {
	    setMessage("Ошибка удаления. "+result.result, true);
	    return;
	}
	
	qS(".submit-window").style.display = "none";

	if (current_to_delete[0] == "column") {
	    setMessage(`Поле ${current_to_delete[1]} удалено...`);
	    getColumns(current_to_delete[2]);
	    
	    current_to_delete = ["table", current_to_delete[2], ''];
	    qS(".tools-object-short-description").innerHTML = `Таблица: <u>${current_to_delete[1]}</u>`;
	} else {
	    setMessage(`Таблица ${current_to_delete[1]} удалена...`);
	    getTables();

	    current_to_delete = null;
	    qS(".tools-object-short-description").innerHTML = '';
	}
	    
    }).catch((error) => {
	console.log("ERROR (delete item):", error);
	setMessage("Ошибка удаления. "+error, true);
    });
}

function connect() {
    USERNAME = "d";
    PASSWORD = "314253";
    SERVER = "localhost";
    PORT = "";
    DB = "Test";

    checkConnection();
    
    /*
    qS(".server-connect-window").style.display = "block";

    qS(".connect").onclick = (e) => {
	USERNAME = qS("#input-username").value;
	PASSWORD = qS("#input-password").value;
	SERVER = qS("#input-server").value;
	PORT = qS("#input-port").value;
	DB = qS("#input-table").value;

	//e.target.onclick = null;

	checkConnection();
    }
    */
}

function appendDataTypeOptions() {
    let select_el = qS("#input-fieldtype");

    for (let dt_ind in FIELDS_DATA_TYPES) {
	select_el.append(create("option", {"value": dt_ind}, [], FIELDS_DATA_TYPES[dt_ind]));
    }
}

function init() {
    qS(".module-window-close", null, true).forEach((item) => {
	item.onclick = (e) => {
	    e.target.parentNode.style.display = "none";
	}
    });

    qS(".tools-sql").onclick = () => {
	qS(".sql-window").style.display = "block";
    }

    qS(".tools-add-table").onclick = () => {
	qS(".create-table-window").style.display = "block";
    }

    qS(".create-table").onclick = () => {
	let tableName = qS("#input-tablename").value;

	if (tableName.length == 0) {
	    setMessage("Поле названия таблицы пустое.", true);
	    return;
	}

	createTable(tableName);
    }

    qS(".sql-request-input").onchange = (e) => {
	let sql = e.target.value;
	e.target.value = '';

	if (sql.length == 0) return 0;

	makeSqlRequest(sql);
    }

    qS(".create-field").onclick = (e) => {
	if (table_to_add_field == null) {
	    setMessage("Таблица не выбрана.", true);
	    return;
	}

	createField();
    }

    qS(".submit-action").onclick = () => {
	if (current_to_delete == null) {
	    setMessage("Нет выбранных элементов для удаления.", true);
	    return;
	}

	deleteItem();
    }

    // set options of fields data type in selector to create new field
    appendDataTypeOptions();
}

window.addEventListener("load", () => {
    connect();
    //init();
});
