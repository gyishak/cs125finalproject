USE youth_db;

-- Clear existing data
DELETE FROM AttendanceStudent;
DELETE FROM VolunteerRecord;
DELETE FROM AttendanceRecord;
DELETE FROM EventLeader;
DELETE FROM GroupMember;
DELETE FROM GroupLeader;
DELETE FROM Event;
DELETE FROM AGroup;
DELETE FROM Volunteer;
DELETE FROM Leader;
DELETE FROM Student;
DELETE FROM Guardian;
DELETE FROM EVENT_TYPE;

-- Event Types
INSERT INTO EVENT_TYPE (ID, name) VALUES
  (1, 'Youth Group Night'),
  (2, 'Service Project'),
  (3, 'Retreat'),
  (4, 'Bible Study'),
  (5, 'Worship Night');

-- Guardians (More!)
INSERT INTO Guardian (ID, firstName, lastName) VALUES
  (1, 'Mary',   'Johnson'),
  (2, 'David',  'Smith'),
  (3, 'Karen',  'Lee'),
  (4, 'Robert', 'Martinez'),
  (5, 'Jennifer', 'Wilson'),
  (6, 'Michael', 'Brown'),
  (7, 'Sarah', 'Garcia'),
  (8, 'James', 'Rodriguez'),
  (9, 'Linda', 'Davis'),
  (10, 'William', 'Anderson');

-- Students (More!)
INSERT INTO Student (ID, guardianID, firstName, lastName) VALUES
  (1, 1, 'Emily',  'Johnson'),
  (2, 1, 'Jacob',  'Johnson'),
  (3, 2, 'Olivia', 'Smith'),
  (4, 3, 'Ethan',  'Lee'),
  (5, 4, 'Sophia', 'Martinez'),
  (6, 4, 'Mason', 'Martinez'),
  (7, 5, 'Isabella', 'Wilson'),
  (8, 6, 'Liam', 'Brown'),
  (9, 7, 'Ava', 'Garcia'),
  (10, 8, 'Noah', 'Rodriguez'),
  (11, 9, 'Mia', 'Davis'),
  (12, 10, 'Lucas', 'Anderson'),
  (13, 5, 'Charlotte', 'Wilson'),
  (14, 6, 'Oliver', 'Brown'),
  (15, 7, 'Amelia', 'Garcia');

-- Groups
INSERT INTO AGroup (ID, name) VALUES
  (1, 'Middle School Girls'),
  (2, 'Middle School Boys'),
  (3, 'High School Mixed'),
  (4, 'Elementary Group'),
  (5, 'Leadership Team');

-- Leaders (More!)
INSERT INTO Leader (ID, firstName, lastName) VALUES
  (1, 'Sarah',   'Brown'),
  (2, 'Michael', 'Davis'),
  (3, 'Laura',   'Green'),
  (4, 'Daniel',  'White'),
  (5, 'Rachel',  'Thompson');

-- Volunteers (More!)
INSERT INTO Volunteer (ID, firstName, lastName) VALUES
  (1, 'Daniel', 'Perez'),
  (2, 'Ashley', 'Nguyen'),
  (3, 'Robert', 'King'),
  (4, 'Emma', 'Taylor'),
  (5, 'Joshua', 'Moore'),
  (6, 'Amanda', 'Jackson');

-- Events (More!)
INSERT INTO Event (ID, event_typeID, Type, Notes) VALUES
  (1, 1, 'Youth Group Night', 'Weekly meeting with games, worship, and small groups.'),
  (2, 2, 'Service Project',   'Volunteering at the local food bank.'),
  (3, 3, 'Retreat',           'Weekend retreat at the mountain camp.'),
  (4, 1, 'Game Night',        'Fun evening with board games and pizza.'),
  (5, 4, 'Wednesday Bible Study', 'Deep dive into the Gospel of John.'),
  (6, 5, 'Worship Night',     'Evening of praise and worship music.'),
  (7, 2, 'Park Cleanup',      'Community service at Memorial Park.'),
  (8, 3, 'Summer Camp',       'Week-long summer camp at Lake Pleasant.'),
  (9, 1, 'Movie Night',       'Watching faith-based film with discussion.'),
  (10, 4, 'Small Group Leaders Meeting', 'Training for small group facilitators.');

-- Group Leaders
INSERT INTO GroupLeader (ID, groupID, leaderID) VALUES
  (1, 1, 1),
  (2, 2, 2),
  (3, 3, 3),
  (4, 4, 4),
  (5, 5, 5);

-- Group Members
INSERT INTO GroupMember (ID, groupID, studentID) VALUES
  (1, 1, 1),
  (2, 1, 3),
  (3, 1, 7),
  (4, 1, 9),
  (5, 2, 2),
  (6, 2, 4),
  (7, 2, 8),
  (8, 2, 10),
  (9, 3, 5),
  (10, 3, 6),
  (11, 3, 11),
  (12, 4, 12),
  (13, 4, 13),
  (14, 5, 14),
  (15, 5, 15);

-- Event Leaders
INSERT INTO EventLeader (ID, leaderID, eventID) VALUES
  (1, 1, 1),
  (2, 2, 1),
  (3, 2, 2),
  (4, 3, 3),
  (5, 1, 4),
  (6, 4, 5),
  (7, 5, 6),
  (8, 2, 7),
  (9, 3, 8),
  (10, 1, 9);

-- Attendance Records
INSERT INTO AttendanceRecord (ID, eventID, theDATE, theTime, RSVP) VALUES
  (1, 1, '2025-02-05', '18:30:00', 'Yes'),
  (2, 1, '2025-02-12', '18:30:00', 'Yes'),
  (3, 2, '2025-03-01', '09:00:00', 'Maybe'),
  (4, 3, '2025-04-18', '17:00:00', 'Yes'),
  (5, 4, '2025-02-20', '19:00:00', 'Yes'),
  (6, 5, '2025-02-26', '19:00:00', 'Yes');

-- Volunteer Records
INSERT INTO VolunteerRecord (ID, volunteerID, eventID) VALUES
  (1, 1, 2),
  (2, 2, 2),
  (3, 3, 3),
  (4, 4, 7),
  (5, 5, 8),
  (6, 6, 1);

-- Student Attendance (More records!)
INSERT INTO AttendanceStudent (ID, eventID, studentID, theDATE, theTime) VALUES
  (1, 1, 1, '2025-02-05', '18:30:00'),
  (2, 1, 2, '2025-02-05', '18:30:00'),
  (3, 1, 3, '2025-02-05', '18:30:00'),
  (4, 2, 1, '2025-03-01', '09:00:00'),
  (5, 2, 4, '2025-03-01', '09:00:00'),
  (6, 3, 5, '2025-04-18', '17:00:00'),
  (7, 3, 6, '2025-04-18', '17:00:00'),
  (8, 4, 1, '2025-02-20', '19:00:00'),
  (9, 4, 7, '2025-02-20', '19:00:00'),
  (10, 5, 2, '2025-02-26', '19:00:00'),
  (11, 5, 8, '2025-02-26', '19:00:00'),
  (12, 6, 9, '2025-03-05', '18:00:00'),
  (13, 6, 10, '2025-03-05', '18:00:00');