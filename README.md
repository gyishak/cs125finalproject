# Database Design Final Project: Youth Group Management System
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

**How to run?**<br><br> 
                                        1. **Pull the image with command:** docker pull gyishak/youth-group-app:latest <br>
                                        2. **Run the container:** <br>
                                           docker run -p 8000:8000 --link mysql-cs125:mysql --link mongodb:mongo --link redis:redis -e 
                                           DB_HOST=mysql -e DB_PORT=3306 -e DB_USER=root -e DB_PASSWORD=cs125 -e 
                                           DB_NAME=youth_db gyishak/youth-group-app:latest <br>
                                        3. **Open Link:** http://localhost:8000/ <br>
                                        4. **Enjoy!** <br>

     
