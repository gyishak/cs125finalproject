DROP DATABASE IF EXISTS youth_db;
CREATE DATABASE youth_db;
USE youth_db;

CREATE TABLE EVENT_TYPE(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60)
);

CREATE TABLE Event(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Type VARCHAR(60),
    Notes TEXT,
    event_typeID INT,
    FOREIGN KEY (event_typeID) REFERENCES EVENT_TYPE(ID)
);

CREATE TABLE Leader(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(60),
    lastName VARCHAR(60)
);

CREATE TABLE Volunteer(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(60),
    lastName VARCHAR(60)
);

CREATE TABLE AGroup(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60)
);

CREATE TABLE Guardian(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(60),
    lastName VARCHAR(60)
);

CREATE TABLE Student(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    guardianID INT,
    firstName VARCHAR(60),
    lastName VARCHAR(60),
    FOREIGN KEY (guardianID) REFERENCES Guardian(ID)
);


CREATE TABLE GroupMember(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    groupID INT,
    studentID INT,
    FOREIGN KEY (groupID) REFERENCES AGroup(ID),
    FOREIGN KEY (studentID) REFERENCES Student(ID),
    UNIQUE (groupID, studentID)
);

CREATE TABLE EventLeader(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    leaderID INT,
    eventID INT,
    FOREIGN KEY (leaderID) REFERENCES Leader(ID),
    FOREIGN KEY (eventID) REFERENCES Event(ID)
);

CREATE TABLE AttendanceRecord(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    eventID INT,
    theDATE DATE,
    theTime TIME,
    RSVP VARCHAR(10),
    FOREIGN KEY (eventID) REFERENCES Event(ID)
);

CREATE TABLE VolunteerRecord(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    volunteerID INT,
    eventID INT,
    FOREIGN KEY (volunteerID) REFERENCES Volunteer(ID),
    FOREIGN KEY (eventID) REFERENCES Event(ID)
);

CREATE TABLE GroupLeader(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    groupID INT,
    leaderID INT,
    FOREIGN KEY (groupID) REFERENCES AGroup(ID),
    FOREIGN KEY (leaderID) REFERENCES Leader(ID),
    UNIQUE (groupID, leaderID)
);

CREATE TABLE AttendanceStudent(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    eventID INT,
    studentID INT,
    theDATE DATE,
    theTime TIME,
    FOREIGN KEY (eventID) REFERENCES Event(ID),
    FOREIGN KEY (studentID) REFERENCES Student(ID)
);
