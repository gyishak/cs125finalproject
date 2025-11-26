USE YouthGroup;

INSERT INTO Guardian (FirstName, LastName) VALUES
('John', 'Doe'),
('Sarah', 'Smith');

INSERT INTO Student (GuardianID, FirstName, LastName) VALUES
(1, 'Michael', 'Doe'),
(2, 'Emily', 'Smith');

INSERT INTO `Group` (Name) VALUES
('Middle School Boys'),
('High School Girls');

INSERT INTO GroupLeader (GroupID) VALUES
(1),
(2);

INSERT INTO Leader (FirstName, LastName) VALUES
('Alex', 'Johnson'),
('Rachel', 'Miller');

INSERT INTO GroupMember (GroupID, StudentID, Name) VALUES
(1, 1, 'Michael Doe'),
(2, 2, 'Emily Smith');

INSERT INTO Event (Type, Notes) VALUES
('Weekly Meeting', 'Pizza night & games'),
('Retreat', 'Weekend cabin trip');

INSERT INTO EventLeader (LeaderID, EventID) VALUES
(1, 1),
(2, 2);

INSERT INTO Volunteer (FirstName, LastName) VALUES
('Tom', 'Brown'),
('Lucy', 'Adams');

INSERT INTO VolunteerRecord (VolunteerID, EventID) VALUES
(1, 1),
(2, 2);

INSERT INTO AttendanceRecord (EventID, Date, Time, RSVP) VALUES
(1, '2025-01-10', '18:00:00', TRUE),
(2, '2025-02-05', '09:00:00', FALSE);