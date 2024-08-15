// =============================================================================
// Classroom Model
// (c) Mathigon
// =============================================================================


import crypto from 'crypto';
import {Document, model, Model, Schema} from 'mongoose';
import {total, unique} from '@mathigon/core';

import {ResponseData} from '../accounts';
import {Course} from '../interfaces';
import {sendClassCodeAddedEmail} from '../utilities/emails';
import {getCourse} from '../utilities/utilities';
import {isClassCode} from '../utilities/validate';
import {CourseAnalytics} from './analytics';
import {Progress} from './progress';
import {User, UserDocument} from './user';

const random = (length: number) => crypto.randomBytes(length).toString('base64').toUpperCase().replace(/[+/\-_0O]/g, 'A').slice(0, length);


export interface ClassroomDocument extends Document {
  title: string;
  code: string;
  admin: string;
  teachers: string[];
  students: string[];

  // Methods
  getStudents: () => Promise<UserDocument[]>;
  addStudent: (user: UserDocument) => Promise<ResponseData>;
  isTeacher: (userId: string) => boolean;
  getDashboardData: () => Promise<{studentData: unknown, courseData: unknown}>;
}

interface ClassroomModel extends Model<ClassroomDocument> {
  // Static Methods
  getStudents: (user: UserDocument) => Promise<UserDocument[]>;
  getTeachers: (user: UserDocument) => Promise<UserDocument[]>;
  lookup: (code: string) => Promise<ClassroomDocument|undefined>;
  make: (title: string, admin: UserDocument) => ClassroomDocument;
}

const ClassroomSchema = new Schema<ClassroomDocument, ClassroomModel>({
  title: {type: String, required: true, maxLength: 32, trim: true},
  code: {type: String, index: true, unique: true, required: true},
  admin: {type: String, index: true, required: true},
  teachers: {type: [String], required: true, index: true, default: []},
  students: {type: [String], required: true, index: true, default: []}
}, {timestamps: true});

ClassroomSchema.methods.getStudents = async function() {
  const students = await User.find({_id: this.students}).exec();
  return students.sort((a, b) => a.sortingName.localeCompare(b.sortingName));
};

ClassroomSchema.methods.addStudent = async function(student: UserDocument) {
  if (student.type !== 'student') return {error: 'joinClassError'};
  if (this.students.includes(student.id)) return {error: 'alreadyJoinedClassError'};
  const teacher = (await User.findOne({_id: this.admin}))!;

  // If a restricted student account has not been verified, we do that now.
  if (student.isRestricted && !student.guardianEmail) {
    student.guardianEmail = teacher.email;
    student.guardianConsentToken = undefined;
  }

  this.students.push(student.id);
  await this.save();
  sendClassCodeAddedEmail(student, teacher);  // async

  return {success: 'joinClass', params: [teacher.fullName]};
};

ClassroomSchema.methods.isTeacher = function(userId: string) {
  return this.teachers.includes(userId);
};

// The interfaces for the files returned here are in frontend/dashboard.ts.
ClassroomSchema.methods.getDashboardData = async function(this: ClassroomDocument) {
  const students = await this.getStudents();
  const count = students.length;

  const stats = await Promise.all(students.map(s => CourseAnalytics.getLastWeekStats(s.id)));
  const progress = await Promise.all(students.map(s => Progress.getUserDataMap(s.id)));
  const courses = unique(progress.flatMap(p => Object.keys(p))).sort().map(c => getCourse(c)).filter(c => c) as Course[];

  const studentData = students.map((s, i) => ({
    id: s.id,
    name: s.fullName,
    avatar: s.avatar(64),
    minutes: stats[i].minutes,
    recent: Object.entries(progress[i]).sort((p, q) => q[1].total - p[1].total).map(p => p[0]),
    progress: progress[i]
  }));

  const courseData = courses.map(c => ({
    id: c.id, title: c.title, color: c.color, icon: c.icon || c.hero,
    progress: total(progress.map(p => p[c.id]?.total || 0)) / count,
    sections: c.sections.map(s => ({
      id: s.id, title: s.title, locked: s.locked,
      progress: s.locked ? 0 : total(progress.map(p => p[c.id]?.[s.id] || 0)) / count
    }))
  }));
  courseData.filter(c => c.progress).sort((a, b) => b.progress - a.progress);

  return {studentData, courseData};
};

ClassroomSchema.statics.getTeachers = async function(user: UserDocument) {
  if (user.type !== 'student') return [];
  const classes = await Classroom.find({students: user.id}).exec();
  const teachers = unique(classes.flatMap(c => c.teachers));
  return User.find({_id: teachers});
};

ClassroomSchema.statics.getStudents = async function(user: UserDocument) {
  if (user.type === 'student') return [];
  const classes = await Classroom.find({teachers: user.id}).exec();
  const students = unique(classes.flatMap(c => c.students));
  return User.find({_id: students});
};

ClassroomSchema.statics.lookup = function(code: string) {
  if (!isClassCode(code)) return;
  return Classroom.findOne({code}).exec();
};

ClassroomSchema.statics.make = function(title: string, admin: UserDocument) {
  const code = random(4) + '-' + random(4);
  return new Classroom({title: title.trim() || 'Untitled Class', code, admin: admin.id, teachers: [admin.id]});
};

export const Classroom = model<ClassroomDocument, ClassroomModel>('Classroom', ClassroomSchema);
