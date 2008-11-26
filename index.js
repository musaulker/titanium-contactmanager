	
		var CM = {
			
			currentFolder: 1,
			currentFolderName: "",
			inEditMode: false,
			tempEditValue: "",
			
			db: google.gears.factory.create('beta.database'),

			SearchPrep: function()
			{
				if($("searchField").value == "Search Folder")
				{
					$("searchField").value = " "; // Safari quirk work around
					$("searchField").value = $("searchField").value.trim(); // Safari quirk work around
				}
				else if($("searchField").value.trim() == "")
				{
					$("searchField").value = "Search Folder";
				}
			},			

			Init: function() 
			{
				Logger.info("javascript init")
				
				CM.db.open('cm-database');
				
				//CM.db.execute('DROP TABLE CONTACTS');
				//CM.db.execute('DROP TABLE FOLDERS');
				
				CM.db.execute(CM.SQL.createContacts);
				CM.db.execute(CM.SQL.createFolders);
				
				var rs = CM.db.execute(CM.SQL.countFolders);
				
				if(rs.isValidRow() && rs.field(0) == 0)
				{
					$MQ("r:cm.folders.add", 
					{
						"params":
						{
							folderName: "All Contacts",
							displayOrder: 0
						}
					});
				}
				
				rs.close();
				
				$MQ("r:cm.folders.get");
				$MQ("r:cm.contacts.get");
				$MQ("l:cm.folders.select[id=1]");
				
			},
			
			publishData: function(rs, message)
			{
				var results = [];
				
				while (rs.isValidRow()) 
				{
					var row = {}
					
					for(var i=0; i < rs.fieldCount(); i++)
					{
						row[rs.fieldName(i)] = rs.field(i); 
					}
					
					results.push(row);
					rs.next();
				}

				//alert(Object.toJSON(results).toString());
				Logger.info(message)
				
				$MQ(message, { "results": results });
			},
			
			SQL:
			{
				countContacts: "SELECT COUNT(*) FROM Contacts",
				countContactsByFolderId: "SELECT COUNT(*) FROM Contacts WHERE folderId =?",
				getContacts: "SELECT * FROM Contacts WHERE contactName like ? ORDER BY displayOrder, contactName DESC",
				getContactsByFolderId: "SELECT * FROM Contacts WHERE folderId = ? AND contactName like ? ORDER BY displayOrder, contactName DESC",
				addContact: "INSERT INTO Contacts (folderId, contactName, title, email, url, phoneWork, phoneHome, " +
							"address, city, state, zip, dateCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				deleteContact: "DELETE FROM Contacts WHERE id=(?)",
				deleteContactsByFolderId: "DELETE FROM Contacts where FolderId=?",
				createContacts: "CREATE TABLE IF NOT EXISTS Contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, " + 
								"folderId INT, contactName TEXT, title TEXT, displayOrder INT, dateCreated DATE," +
								"email TEXT, phoneWork TEXT, phoneHome TEXT, url TEXT, address TEXT," +
								"city TEXT, state TEXT, zip INT, country TEXT)",
				
				countFolders: "SELECT COUNT(*) FROM Folders",
				getFolders: "SELECT id, folderName, displayOrder, (SELECT COUNT(*) FROM Contacts WHERE folderId=Folders.Id)" + 
							" AS folderContentCount FROM Folders ORDER BY displayOrder, folderName ASC",
				addFolder: "INSERT INTO Folders (folderName) VALUES (?)",
				updateFolder: "UPDATE Folders SET folderName=(?) WHERE id=(?)",
				deleteFolder: "DELETE FROM Folders WHERE id=(?)",
				createFolders: "CREATE TABLE IF NOT EXISTS Folders" +
				           " (id INTEGER PRIMARY KEY AUTOINCREMENT, folderName TEXT, displayOrder INT)"	
			}
		};
		
		$MQL("r:cm.folders.updateTotal", function()
		{	
			var rs = CM.db.execute(CM.SQL.countContacts);
			
			if($("folderContentCount_1"))
			{
				$("folderContentCount_1").innerText = "(" + rs.field(0) + ")";	

			}
			rs.close();
		});
		
		$MQL("r:cm.folders.add", function(msgId, msgData) 
		{
			var folderName = "New Folder";
			
			if(msgData.params)
			{
				folderName = msgData.params.folderName;
			} 

			CM.db.execute(CM.SQL.addFolder, [folderName]);
		});
		
		$MQL("r:cm.folders.update", function(msgId, msgData)
		{	
			CM.db.execute(CM.SQL.updateFolder, [$("folderEdit_"+msgData.id).value, msgData.id]);
		});		
		
		$MQL("r:cm.folders.delete", function(msgId, msgData)
		{
			Logger.info("r:cm.folders.delete (id="+msgData.id+")");
			
			CM.db.execute(CM.SQL.deleteFolder, [msgData.id]);
			CM.db.execute(CM.SQL.deleteContactsByFolderId, [msgData.id]);
		});
		
		$MQL("l:cm.folders.select", function(msgId, msgData)
		{
			Logger.info("l:cm.folders.select (id="+msgData.id+")");
			
			$MQ("r:cm.contacts.get");

				$$(".folder").each(function(folder) // Prototype
				{
					if(folder.id == "folder_"+msgData.id)
					{
						folder.style.backgroundImage = "url(images/cm/cmActiveFolder.png)";
					}
					else
					{
						folder.style.backgroundImage = "";
					}
				});
				
				CM.currentFolder = msgData.id;			
		});
		
		$MQL("r:cm.folders.get", function() 
		{
			Logger.info("r:cm.folders.get");
			
			var rs = CM.db.execute(CM.SQL.getFolders);
			
			CM.publishData(rs, "r:cm.folders.data");

			rs.close();
			
			$MQ("r:cm.folders.updateTotal");

		});		
		
		$MQL("r:cm.contacts.get", function(msgId, msgData)
		{
			var searchTerm = msgData.searchTerm;
			
			if(!searchTerm) 
			{
				searchTerm = $("searchField").value.trim();
				
				if(searchTerm.toLowerCase().indexOf("search folder") != -1)
				{
					searchTerm = "";
				}
			}
			
			searchTerm = '%' + searchTerm.trim() + '%';
			
			Logger.info("r:cm.contacts.get (searchTerm='"+searchTerm+"')");
			
			if (CM.currentFolder == 1) 
			{
				var rs = CM.db.execute(CM.SQL.getContacts, [searchTerm]);
			}
			else
			{
				
				var rs = CM.db.execute(CM.SQL.getContactsByFolderId, [CM.currentFolder, searchTerm]);
			}

			CM.publishData(rs, "r:cm.contacts.data");

			rs.close();
		});
		
		$MQL("r:cm.contacts.add", function()
		{
			Logger.info("r:cm.contacts.add");
			
			CM.db.execute(CM.SQL.addContact, [CM.currentFolder, 
												"New Contact", // name
												"Untitled", // title
												"username@domain.com", // email
												"www.domian.com", // url 
												"", // phoneWork
												"", // phoneHome
												"", // address
												"", // city
												"", // state
												"", // zip
												new Date().getTime()]);			
		});		

		$MQL("r:cm.contacts.update", function(msgId, msgData)
		{ 
			Logger.info("r:cm.contacts.update (fieldId="+msgData.fieldId+", recordId="+msgData.recordId+")");
			// this sql statement is inline because execute does not seem to accept a parameter as a valid column name.
			CM.db.execute("UPDATE Contacts SET "+msgData.fieldId+"=(?) WHERE id=(?)", [$(msgData.fieldId+"_"+msgData.recordId).value, msgData.recordId]);
		});

		$MQL("r:cm.contacts.delete", function(msgId, msgData)
		{
			Logger.info("r:cm.contacts.delete (id="+msgData.id+")");
			
			CM.db.execute(CM.SQL.deleteContact, [msgData.id]);			
		});
