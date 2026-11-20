Use Cases

Organization (9)

Use Case: Login Organization
Participating Actor: Organization
Entry Condition: Organization is not authorized
Exit Criteria: Organization is authorized
Flow of Events:
Organization requests to log in
Donazion logs in Organization and refreshes display

Use Case: Change Password
Participating Actor: Organization
Entry Condition: Organization is authorized
Exit Criteria: Organization has new password
Flow of Events:
Organization requests to change password
Donazion changes password and refreshes display

Use Case: Show Dashboard
Participating Actor: Organization
Entry Condition: Organization is authorized
Exit Criteria: Dashboard is shown
Flow of Events:
Organization requests to show dashboard
Donazion shows dashboard and refreshes display

Use Case: Add Category
Participating Actor: Organization
Entry Condition: Organization is authorized and category does not exist
Exit Criteria: Category is added
Flow of events:
Organization requests to add a category
Donazion adds category and refreshes display

Use Case: Remove Category
Participating Actor: Organization
Entry Condition: Organization is authorized, category exists and contains no category items
Exit Criteria: Category is removed
Flow of Events:
Organization requests to remove a category
Donazion removes category and refreshes display

Use Case: Upload Category Items
Participating Actor: Organization
Entry Condition: Organization is authorized, all category items do not exist, and all category items are unique
Exit Criteria: Category items are uploaded
Flow of Events:
Organization requests to upload multiple items to a category
Donazion uploads category items and refreshes display

Use Case: Remove Category Item
Participating Actor: Organization
Entry Condition: Organization is authorized and category item exists
Exit Criteria: Category item is removed
Flow of Events:
Organization requests to remove a category item
Donazion removes category item and refreshes display.

Use Case: Edit Category Item
Participating Actor: Organization
Entry Condition: Organization is authorized and category item exists
Exit Criteria: Category item is edited
Flow of Events:
Organization requests to edit an item in a category
Donazion edits category item and refreshes display

Use Case: List DonationCenters
Participating Actor: Organization
Entry Condition: Organization is authorized
Exit Criteria: All registered donation centers listed in a paginated format
Flow of Events:
Organization requests to list DonationCenters
Donazion lists DonationCenters and refreshes display

DonationCenter (7)

Use Case: Register DonationCenter
Participating Actor: DonationCenter
Entry Condition: DonationCenter is not already registered
Exit Criteria: DonationCenter is registered
Flow of Events:
DonationCenter requests to be registered
Donazion registers DonationCenter and refreshes display



Use Case: Login DonationCenter
Participating Actor: DonationCenter
Entry Condition:  DonationCenter is registered and not authorized
Exit Criteria: DonationCenter is authorized
Flow of Events:
DonationCenter requests to log in
Donazion logs in DonationCenter and refreshes display

Use Case: Remove DonationCenter
Participating Actor: DonationCenter
Entry Condition: DonationCenter is authorized
Exit Criteria: DonationCenter is no longer registered
Flow of Events:
DonationCenter requests to be removed from the organization
Donazion removes DonationCenter and refreshes display

Use Case: Show Dashboard
Participating Actor: DonationCenter
Entry Condition: DonationCenter is authorized
Exit Criteria: DonationCenter’s dashboard is shown
Flow of Events:
DonationCenter requests to show dashboard
Donazion shows dashboard and refreshes display

Use Case: List Inventory
Participating Actor: DonationCenter
Entry Condition: DonationCenter is authorized
Exit Criteria: Inventory for DonationCenter is listed in paginated format
Flow of Events:
DonationCenter requests to list inventory
Donazion lists inventory and refreshes display

Use Case: Add Wishlist Item
Participating Actor: DonationCenter
Entry Condition: DonationCenter is authorized, wishlist item does not already exist
Exit Criteria: Wishlist item is added for DonationCenter
Flow of Events:
DonationCenter requests to add a wishlist item
Donazion adds wishlist item and refreshes display






Use Case: Remove Wishlist Item
Participating Actor: DonationCenter
Entry Condition: DonationCenter is authorized, wishlist item exists
Exit Criteria: Wishlist item is removed from DonationCenter
Flow of Events:
DonationCenter requests to remove a wishlist item
Donazion removes wishlist item and refreshes display


Donor (7)

Use Case: List DonationCenters
Participating Actor: Donor
Entry Condition: None
Exit Criteria: DonationCenters are listed in paginated format
Flow of Events:
Donor requests to list the DonationCenters
Donization lists the DonationCenters and updates display

Use Case: Map DonationCenters
Participating Actor: Donor
Entry Condition: None
Exit Criteria: Map of DonationCenters centered at the inputted zip code is displayed
Flow of Events:
Donor requests a map of DonationCenters centered at a zipcode
Donazion maps DonationCenters and updates display

Use Case: Search DonationCenters by WishList
Participating Actor: Donor
Entry Condition: None
Exit Criteria: DonationCenters with given item(s) on their wishlist are displayed in a paginated format
Flow of Events:
Donor requests to search DonationCenters by their wishlist items
Donazion searches for DonationCenters that contain the specified wishlist item(s) and refreshes display

Use Case: Prepare Box
Participating Actor: Donor
Entry Condition: Donor selects a DonationCenter location that exists within the Organization
Exit Criteria: Box has been assigned to a DonationCenter
Flow of Events:
Donor requests to prepare a box
Donazion prepares the box and updates the display

Use Case: Add Item
Participating Actor: Donor
Entry Condition: Item is not already in box, box already prepared, and item is within price range for desired DonationCenter
Exit Criteria: Item is added to box
Flow of Events:
Donor requests to add an item to box
Donazion adds item and refreshes display

Use Case: Remove Item
Participating Actor: Donor
Entry Condition: Item is already in box
Exit Criteria: Item is removed from box
Flow of Events:
Donor requests to remove an item
Donazion removes item and refreshes display

Use Case: Complete Box Donation
Participating Actor: Donor
Entry Condition: Box has at least one item
Exit Criteria: Donor receives a PDF documentation of donation
Flow of Events:
Donor requests to complete box donation
Donazion completes box donation and refreshes display
UML Class Diagram


GUI Storyboards
Prompt:
make a UI with the following use cases: Organization: Use case: Login Organization Use case: Change Password Use Case: Show Dashboard Use Case: Add Category Use Case: Remove Category Use Case: Upload Category Items Use Case: Remove Category Item Use Case: Edit Category Item List DonationCenters [pagination] DonationCenter: Use Case: Register DonationCenter Use Case: Login DonationCenter Use Case: Remove DonationCenter Use Case: Show Dashboard Use Case: List Inventory Use Case: Add Wishlist Item Use Case: Remove Wishlist Item Donor: Use Case: List DonationCenters [pagination] Use Case: Map DonationCenters Use Case: Search DonationCenters by WishList [pagination] Use Case: Prepare Box Use Case: Add Item Use Case: Remove Item Use Case: Complete Box Donation More info: Organization can List donation centers and include the total number of items and total value of inventory DonationCenter: donationCenter can register itself with the organization, using a street address and a long and lat coords. Donor can enter zip code and get a map of location around zip code. they can also find donation centers based on items on their whishlist and find donation centers that aceept those items. I want a nav bar at the top for each login. Once specific orginations or donation center logs in I want a side bar with options like overview, value guide, etc

Prompt 2: I want a home page. where there is a nav bar in which you go to sign in pages for donation center or organization. there is no login for donor

Process:
We used AI to create a jumping-off point for our storyboard. We gave it our use cases and some info about how we want the UI, then we added functionality that the AI missed manually by importing Figma AI features into our main Figma group project canvas. We also removed a lot of the “feel good” messages and other stuff we didn't need (e.g. there was info about when a donation center closed, which is not relevant).
