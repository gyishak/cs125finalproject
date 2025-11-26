# cs125finalproject
Serkan Durna & Grace Yishak <br>
CS 125<br>
Mike Ryu


**Who is using this?**:<br><br> This app and project is designed to be used by churches or youth ministers that run/organize youth events within a church. <br><br>
**What do they want to do?**:<br><br> Users will be able to manage youth centered events whether that is small groups, weekly, events, etc. Through our project, users can keep track of items like attendance of an event, volunteer list, etc. This is a way to localize all data centered around the youth ministry within a church and provide easy access to this data. <br><br>
**What do they want to do?**:<br><br> Users should be able to per event:<br><br>
                                  1. Keep track of students, parents/guardians, leaders, and volunteers<br>
                                  2. Register students for events and record attendance<br>
                                  3. Manage small groups and who is in which group<br>
                                  4. Record notes about what happened in a particular meeting or small group<br>
                                  5. See who is currently checked in to an event in “real time”<br><br>
**What is your team name?**:<br><br> Our team name is Serkan&Grace. Our team includes Serkan Durna and Grace Yishak. <br><br>

**How to spin up our server?**:<br><br> Run Commands: <br><br>
                                        1. docker start mysql-cs125 <br>
                                        2. docker exec -i mysql-cs125 mysql -u root -pcs125 < schema.sql <br>
                                        3. docker exec -i mysql-cs125 mysql -u root -pcs125 < data.sql <br>
                                        4. python app.py <br>

     
