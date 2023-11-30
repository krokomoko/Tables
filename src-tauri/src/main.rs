// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use postgres::{Client, NoTls, Row};

struct SQLOutput {
    fields: Vec<String>,
    values: Vec<Vec<String>>,
}

impl SQLOutput {
    /*fn set_fields(&mut self, names: &Vec<String>) -> Result<(), String> {
	for name in names.iter() {
	    self.fields.push(name.to_string());
	}

	Ok(())
    }*/
    
    fn add_row(&mut self, values: &Vec<String>) -> Result<(), String> {
	if self.fields.len() == 0 || self.fields.len() != values.len() {
	    return Err("Error length of values or fields of SQLOutput".to_string());
	}
	
	let mut row: Vec<String> = Vec::new();
	
	for value in values.iter() {
	    row.push(value.to_string());
	}

	self.values.push(row);
	
	Ok(())
    }
    
    fn to_json(&self) -> Result<String, String> {
	let mut result: String = "{ \"fields\": [".to_string();
	
	for field in self.fields.iter() {
	    result = result + "\"" + field  + "\", ";
	}

	if self.fields.len() > 0 {
	    result = result[..result.len()-2].to_string();
	}

	result = result + "], \"values\": [";

	for row in self.values.iter() {
	    result = result + "[";
	    for value in row.iter() {
		result = result + "\"" + value  + "\", ";
	    }
	    result = result[..result.len()-2].to_string() + "], ";
	}

	if self.values.len() > 0 {
	    result = result[..result.len()-2].to_string();
	}

	Ok(result + "]}")
    }
}

fn get_value_from_row(ind: usize, row: &Row) -> Result<String, String> {
    let column_value: Option<String> = match row.try_get::<usize, Option<String>>(ind) {
	Ok(v) => v,
	Err(_) => {
	    let column_value_i: Option<i32> = match row.try_get::<usize, Option<i32>>(ind) {
		Ok(v) => v,
		Err(_) => None
	    };

	    match column_value_i {
		Some(v) => Some(format!("{}", v)),
		None => None
	    }
	},
    };

    let column_value_str = match column_value {
	Some(v) => v,
	None => "NULL".to_string(),
    };

    Ok(column_value_str)
}


// select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' AND table_name='some_table';

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn get_tables(username: &str, password: &str, server: &str, port: &str, table: &str) -> Result<String, ()> {
    let connection_str = &format!("postgresql://{}:{}@{}:{}/{}",
				  username,
				  password,
				  server,
				  port,
				  table						  
    );
    let mut client = Client::connect(connection_str, NoTls).unwrap();
    
    let mut output = SQLOutput {
	fields: vec!["table_name".to_string()],
	values: Vec::new(),
    };

    let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public';";

    for row in client.query(sql, &[]).unwrap() {
	let name: &str = row.get(0);
	let _ = output.add_row(&vec![name.to_string()]);
    }

    let result = match output.to_json() {
	Ok(result) => result,
	Err(_) => "{ \"result\": \"error\" }".to_string(),
    };
    
    Ok(result)
}

#[tauri::command]
fn get_columns(table_name: &str, username: &str, password: &str, server: &str, port: &str, table: &str) -> Result<String, ()> {
    let sql = format!("select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' AND table_name='{}';", table_name);

    let connection_str = &format!("postgresql://{}:{}@{}:{}/{}",
				  username,
				  password,
				  server,
				  port,
				  table						  
    );
    let mut client = Client::connect(connection_str, NoTls).unwrap();

    let mut output = SQLOutput {
	fields: vec![
	    "column_name".to_string(),
	    "data_type".to_string(),
	    "is_nullable".to_string(),
	    "column_default".to_string()
	],
	values: Vec::new(),
    };

    for row in client.query(&sql, &[]).unwrap() {
	let column_name: String = row.get(0);
	let data_type: String = row.get(1);
	let is_nullable: String = row.get(2);
	let column_default: String = match row.get(3) {
	    Some(x) => x,
	    None => "(-----)".to_string(),
	};

	let _ = output.add_row(&vec![
	    column_name,
	    data_type,
	    is_nullable,
	    column_default
	]);
    }

    let result = match output.to_json() {
	Ok(result) => result,
	Err(_) => "{ \"result\": \"error\" }".to_string(),
    };
    
    Ok(result)
}

#[tauri::command]
fn sql_request(sql: &str, username: &str, password: &str, server: &str, port: &str, table: &str) -> Result<String, String> {
    let connection_str = &format!("postgresql://{}:{}@{}:{}/{}",
				  username,
				  password,
				  server,
				  port,
				  table						  
    );
    let mut client = Client::connect(connection_str, NoTls).unwrap();

    if sql.contains("select") {

	let mut output = SQLOutput {
	    fields: Vec::new(),
	    values: Vec::new(),
	};

	let mut flag = false;

	let query_result_r = client.query(sql, &[]);

	match query_result_r {
	    Ok(query_result) => {
		for row in query_result {
		    if !flag {
			for column in row.columns().iter() {
			    output.fields.push(column.name().to_string());
			}
			flag = true;
		    }
		    
		    let mut new_values_row: Vec<String> = vec![];
		    for column_ind in 0..row.len() {
			let column_value: String = match get_value_from_row(column_ind, &row) {
			    Ok(v) => v,
			    Err(_) => "NULL".to_string()
			};
			
			new_values_row.push(column_value);
		    }
		    output.values.push(new_values_row);
		}

		let result = match output.to_json() {
		    Ok(result) => result,
		    Err(_) => "{ \"result\": \"error\" }".to_string(),
		};

		println!("Result: {}", result);

		return Ok(result);		
	    },
	    Err(_e) => return Err(format!("{}", _e))
	};
    } else {
	match client.execute(sql, &[]) {
	    Ok(_) => return Ok("{\"result\": \"success\"}".to_string()),
	    Err(e) => return Ok("{".to_string() + &format!("\"result\": \"{}\"", e) + "}"),
	}
	

    }
}

#[tauri::command]
fn check_connection(username: &str, password: &str, server: &str, port: &str, table: &str) -> Result<String, String> {
    let connection_str = &format!("postgresql://{}:{}@{}:{}/{}",
				  username,
				  password,
				  server,
				  port,
				  table						  
    );

    let connect_result = Client::connect(connection_str, NoTls);

    match connect_result {
	Ok(_) => return Ok("{\"result\": \"success\"}".to_string()),
	Err(e) => return Ok("{".to_string() + &format!("\"result\": \"{}\"", e) + "}")
    }
}


fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
	    get_tables,
	    get_columns,
	    sql_request,
	    check_connection
	])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

