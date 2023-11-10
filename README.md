# API documentation

## Endpoints

### GET /notes

Retrieve a list of notes

#### Parameters

none

#### Response
```json
{
	"status_code": true,
	"message": "Retrieved successfully",
	"data": [
		{
			"id": 1,
			"title": "title A",
			"person_name": "Yamada Taro",
			"totle_amount": 10000
		}
	]
}
```

### POST /notes

Create a new note

#### Parameters

none

#### Request

```json

{
	"note_title": "title A",
	"person_name": "Yamada Taro",
}
```

#### Response

```json

{
	"status_code": 200,
	"message": "Created successfully",
	"data": {
		"id": 1,
		"note_title": "title A",
		"person_name": "Yamada Taro",
		"totle_amount": 0
	}
}
```

### PUT /notes/{id}

Update a note

#### Parameters

none

#### Request

```json

{
	"note_title": "title A",
	"person_name": "Yamada Taro",
}
```

#### Response

```json

{
	"status_code": 200,
	"message": "Updated successfully",
	"data": {
		"id": 1,
		"note_title": "title A",
		"person_name": "Yamada Taro",
		"totle_amount": 0
	}
}
```

### DELETE /notes/{id}

Delete a note

#### Parameters

none

#### Response

```json

{
	"status_code": 200,
	"message": "Deleted successfully",
}
```

### GET /notes/{id}/transactions

Retrieve a list of transactions

#### Parameters

none

#### Response
```json
{
	"status_code": true,
	"message": "Retrieved successfully",
	"data": [
		{
			"id": 1,
			"created_at": "2023.01.01 00:00",
			"amount": 10000,
			"currency_type": 1,
			"transaction_type": 1,
			"transaction_desctiption": "Dinner"
		}
	]
}
```

### POST /notes/{id}/transactions

Create a new transaction

#### Parameters

none

#### Request

```json

{
	"amount": 10000,
	"currency_type": 1,
	"transaction_type": 1,
	"transaction_desctiption": "Dinner"
}
```

#### Response

```json

{
	"status_code": 200,
	"message": "Created successfully",
	"data": {
		"id": 1,
		"created_at": "2023.01.01 00:00",
		"amount": 10000,
		"currency_type": 1,
		"transaction_type": 1,
		"transaction_desctiption": "Dinner"
	}
}
```

### PUT /notes/{id}/transactions/{id}

Update a transaction

#### Parameters

none

#### Request

```json

{
	"amount": 10000,
	"currency_type": 1,
	"transaction_type": 1,
	"transaction_desctiption": "Dinner"
}
```

#### Response

```json

{
	"status_code": 200,
	"message": "Updated successfully",
	"data": {
		"id": 1,
		"created_at": "2023.01.01 00:00",
		"amount": 10000,
		"currency_type": 1,
		"transaction_type": 1,
		"transaction_desctiption": "Dinner"
	}
}
```

### DELETE /notes/{id}/transactions{id}

Delete a transactions

#### Parameters

none

#### Response

```json

{
	"status_code": 200,
	"message": "Deleted successfully",
}
```





