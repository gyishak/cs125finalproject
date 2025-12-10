USE youth_db;

INSERT INTO EVENT_TYPE (ID, name) VALUES
  (1, 'Youth Group Night'),
  (2, 'Service Project'),
  (3, 'Retreat');

INSERT INTO Guardian (ID, firstName, lastName) VALUES
  (1, 'Mary',   'Johnson'),
  (2, 'David',  'Smith'),
  (3, 'Karen',  'Lee');

INSERT INTO Student (ID, guardianID, firstName, lastName) VALUES
  (1, 1, 'Emily',  'Johnson'),
  (2, 1, 'Jacob',  'Johnson'),
  (3, 2, 'Olivia', 'Smith'),
  (4, 3, 'Ethan',  'Lee');

INSERT INTO AGroup (ID, name) VALUES
  (1, 'Middle School Girls'),
  (2, 'Middle School Boys'),
  (3, 'High School Mixed');

INSERT INTO Leader (ID, firstName, lastName) VALUES
  (1, 'Sarah',   'Brown'),
  (2, 'Michael', 'Davis'),
  (3, 'Laura',   'Green');

INSERT INTO Volunteer (ID, firstName, lastName) VALUES
  (1, 'Daniel', 'Perez'),
  (2, 'Ashley', 'Nguyen'),
  (3, 'Robert', 'King');

INSERT INTO Event (ID, event_typeID, Type, Notes) VALUES
  (1, 1, 'Youth Group Night', 'Weekly meeting with games, worship, and small groups.'),
  (2, 2, 'Service Project',   'Volunteering at the local food bank.'),
  (3, 3, 'Retreat',           'Weekend retreat at the mountain camp.');

INSERT INTO GroupLeader (ID, groupID) VALUES
  (1, 1),
  (2, 2),
  (3, 3);

INSERT INTO GroupMember (ID, groupID, studentID, firstName, lastName) VALUES
  (1, 1, 1, 'Emily',  'Johnson'),
  (2, 1, 3, 'Olivia', 'Smith'),
  (3, 2, 2, 'Jacob',  'Johnson'),
  (4, 3, 4, 'Ethan',  'Lee');

INSERT INTO EventLeader (ID, leaderID, eventID) VALUES
  (1, 1, 1),
  (2, 2, 1),
  (3, 2, 2),
  (4, 3, 3);

INSERT INTO AttendanceRecord (ID, eventID, theDATE, theTime, RSVP) VALUES
  (1, 1, '2025-02-05', '18:30:00', 'Yes'),
  (2, 1, '2025-02-12', '18:30:00', 'Yes'),
  (3, 2, '2025-03-01', '09:00:00', 'Maybe'),
  (4, 3, '2025-04-18', '17:00:00', 'Yes');

INSERT INTO VolunteerRecord (ID, volunteerID, eventID) VALUES
  (1, 1, 2),
  (2, 2, 2),
  (3, 3, 3);
