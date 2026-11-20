Organization (9)

/organization/login
POST
{
"username": "Org1",
"password": "hashOfPassword"
}




200: {
"securityCredentials": "securityCredentials"
}




400: {
"error": "password is incorrect"
}
400: {
"error": "username is not found"
}


/organization/changePassword
POST
{
"username": "Org1",
"newPassword": "hashOfPassword"
"securityCredentials": "securityCredentials"
}




200: {
"securityCredentials": "securityCredentials"
}




400: {
"error": "Invalid Organization username"
}
400: {
"error": "Organization Not Found"
}

/organization/showDashboard
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials"
}
200: {
"username": "Org1",
"total centers": 7,
"categories": [
{
"name": "clothing",
"items": [
{
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
},
{
"name": "dress shoes",
"lowPrice": 10,
"highPrice": 100
}
]
},
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 50,
"highPrice": 2000
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
}
]
}
]
}


400: {
"error": "Invalid Security Credentials"
}
400: {
"error": "Invalid Organization username"
}


/organization/addCategory
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
"name": "electronics"
}




200: {
"categories": [
{
"name": "clothing",
"items": [
{
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
},
{
"name": "dress shoes",
"lowPrice": 10,
"highPrice": 100
}
]
},
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 50,
"highPrice": 2000
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
}
]
},
{
"name": "electronics",
"items": []
}
]
}




400: {
"error": "category already exists"
}
400: {
"error": "Invalid Security Credentials"
}


/organization/removeCategory
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
"name": "electronics"
}




200: {
"categories": [
{
"name": "clothing",
"items": [
{
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
},
{
"name": "dress shoes",
"lowPrice": 10,
"highPrice": 100
}
]
},
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 50,
"highPrice": 2000
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
}
]
}
]
}




400: {
"error": "category is not empty"
}
400: {
"error": "category does not exist"
}
400: {
"error": "Invalid Security Credentials"
}


/organization/uploadCategoryItems
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
"category": "furniture",
"items": [
{
"name": "bookshelf",
"lowPrice": 30,
"highPrice": 150
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
},
]
}


200: {
"categories": [
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 50,
"highPrice": 2000
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
},
{
"name": "bookshelf",
"lowPrice": 30,
"highPrice": 150
}
]
},
{
"name": "clothing",
"items": []
}
]
}




400: {
"error": "Invalid request. Please provide a valid category and item."
}
400: {
"error": "Bookshelf already exists in the furniture category."
}
400: {
"error": "Invalid Security Credentials"
}


/organization/removeCategoryItem
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
"category": "furniture",
"item": {
"name": "bookshelf"
}
}




200: {
"categories": [
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 50,
"highPrice": 2000
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
}
]
},
{
"name": "clothing",
"items": []
}
]
}




400: {
"error": "Category not found."
}
400: {
"error": "Item not found in category"
}
400: {
"error": "Invalid Security Credentials"
}


/organization/editCategoryItem
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
"category": "furniture",
"item": {
"name": "couch",
"lowPrice": 60,
"highPrice": 2100
}
}
200: {
"categories": [
{
"name": "furniture",
"items": [
{
"name": "couch",
"lowPrice": 60,
"highPrice": 2100
},
{
"name": "table lamp",
"lowPrice": 5,
"highPrice": 30
}
]
},
{
"name": "clothing",
"items": []
}
]
}
400: {
"error": "Category item not found."
}
400: {
"error": "Invalid Security Credentials"
}


/organization/listDonationCenters
POST
{
"username": "Org1",
"securityCredentials": "securityCredentials",
}
200: {
"donationCenters": [
{
"name": "Harbor House",
"location": {
"lat": 42.814,
"lon": -73.940,
"address": "115 King Street, Township, NY",
"zipCode": "12342"
},
"items": 40,
"inventoryValue": 15000,
},
{
"name": "Common Good",
"location": {
"lat": 42.813,
"lon": -73.939,
"address": "113 King Street, Township, NY",
"zipCode": "12342"
},
"items": 67,
"inventoryValue": 30050,
},
{
"name": "Good Neighbors",
"location": {
"lat": 42.815,
"lon": -73.941,
"address": "114 King Street, Township, NY",
"zipCode": "12342"
},
"items": 50,
"inventoryValue": 15000,
}
]
}




400: {
"error": "Invalid Security Credentials"
}
DonationCenter (7)

donationCenter/register
POST
{
"name": "Newport",
"location": {
"zipCode": 97365,
"lat": 43.5081,
"lon": -124.0299
"address": "115 King Street, Township, NY",
},
"password": "hashOfPassword",
"inventory": [],
"wishlist": []
}




200: {
"securityCredentials": "securityCredentials",
}




400: {
"error": "Donation Center already exists"
}
400: {
"error": "Invalid username or password"
}



donationCenter/login
POST
{
"name": "Donation1",
"password": "passwordHash"
}




200: {
"securityCredentials": "securityCredentials"
}






400: {
"error": "password is incorrect"
}
400: {
"error": "username is not found"
}

donationCenter/remove
POST
{
"name": "Downtown Donation Center",
"securityCredentials": "securityCredentials"
}
200: {
"donationCenters": [
{
"name": "Uptown Donation Center",
"location": {
"lat": 38.807,
"lon": -77.056,
"address": "456 Elm St, Cityville, VA",
"zipCode": 23445
}
},
{
"name": "Newport",
"location": {
"zipCode": 97365,
"lat": 43.5081,
"address": "115 King Street, Township, NY",
"lon": -124.0299
},
},
]
}
400: {
"error": "Invalid request. Please provide a valid donation center name."
}
400: {
"error": "Invalid Security Credentials"
}

donationCenter/showDashboard
POST
{
"name": "Harbor House",
"securityCredentials": "securityCredentials"
}
200: {
"name": "Harbor House",
"inventoryCount": 434,
"inventoryValue": 18706,
"wishlist": [
{
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
},
{
"name": "dress shoes",
"lowPrice": 10,
"highPrice": 100
}
],
"recentDonations": [
{
"name": "jellybean",
"price": 100,
"categoryItem": {
"name": "food",
"lowPrice": 0,
"highPrice": 50
}
}
]
}
400: {
"error": "Invalid Security Credentials"
}

donationCenter/listInventory
POST
{
"name": "Harbor House",
"securityCredentials": "securityCredentials"
}
200: {
"inventory": [
{
"name": "Winter coat",
"category": "clothing",
"value": 40
},
{
"name": "laptop",
"category": "electronics",
"value": 150
},
{
"name": "table lamp",
"category": "household",
"value": 20
},
{
"name": "hardcover book",
"category": "books",
"value": 10
}
]
}




400: {
"error": "cannot fetch from server"
}
400: {
"error": "Invalid Security Credentials"
}

donationCenter/addWishlistItem
POST
{
"name": "Harbor House",
"whishlistItem": {
"name": "Winter Jacket",
"lowPrice": 50,
"highPrice": 200
},
"securityCredentials": "securityCredentials"
}
200: {
"wishList": [
{
"name": "Winter Jacket",
"lowPrice": 50,
"highPrice": 200
},
{
"name": "Running Shoes",
"lowPrice": 30,
"highPrice": 150
}
]
}
400: {
"error": "Invalid request. Please provide a valid wish list item."
}
400: {
"error": "Winter jacket already exists."
}
400: {
"error": "Invalid Security Credentials"
}

donationCenter/removeWishlistItem
POST
{
"name": "Harbor House",
"whishlistItem": {
"name": "Winter Jacket",
"lowPrice": 50,
"highPrice": 200
},
"securityCredentials": "securityCredentials"
}
200: {
"wishList": [
{
"name": "Running Shoes",
"lowPrice": 30,
"highPrice": 150
}
]
}
400: {
"error": "Invalid request. Please provide a valid wish list item."
}
400: {
"error": "Invalid Security Credentials"
}
Donor (4)

donor/listDonationCenters
GET
200: {
"donationCenters": [
{
"name": "Uptown Donation Center",
"location": {
"lat": 38.807,
"lon": -77.056,
"address": "456 Elm St, Cityville, VA"
}
},
{
"name": "Harbor House",
"location": {
"lat": 42.814,
"lon": -73.940,
"address": "115 King Street, Township, NY",
"zipCode": "12342"
}
}
]
}


donor/findDonationCenters
POST
{
"zipCode": 01234,
"radius": 10
}


200: {
"donationCenters": [
{
"name": "Uptown Donation Center",
"location": {
"lat": 38.807,
"lon": -77.056,
"address": "456 Elm St, Cityville, VA",
"zipCode": "22314",
},
},
{
"name": "Harbor House",
"location": {
"lat": 42.814,
"lon": -73.940,
"address": "115 King Street, Township, NY",
"zipCode": "12342"
}
}
]
}


400: {
"error": "Zip code does not exist"
}


donor/searchByWishList
POST
{
"wishlistItem": [
{
"name": "winter coat"
},
{
"name": "laptop"
}
]
}




200: {
"donationCenter": [
{
"name": "Harbor House",
"location": {
"lat": 42.814,
"lon": -73.940,
"address": "115 King Street, Township, NY",
"zipCode": "12342"
}
}
]
}






400: {
"error": "items are not found in any donation center's wishlist"
}


donor/donateBox
POST

{
"donationCenter": {
"name": "Harbor House",
"location": {
"lat": 42.814,
"lon": -73.940,
"address": "115 King Street, Township, NY",
"zipCode": "12342"
}
},
"items": [
{
"item": "Women's Columbia Parka",
"price": 50,
"categoryItem": {
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
}
}
]
}
200:
{
"receipt": {
"dateTimeOfDonation": "currentDataTime",
"items": [
{
"item": "Women's Columbia Parka",
"price": 50,
"categoryItem": {
"name": "winter coat",
"lowPrice": 10,
"highPrice": 100
}
}
]
}
}






400: {
"error": "Invalid Item provided"
}
400: {
"error": "Invalid Donation center"
}
400: {
"error": "Box is empty"
}
