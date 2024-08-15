// =============================================================================
// Dashboard Server
// (c) Mathigon
// =============================================================================


import express from 'express';
import {redirect} from './accounts';
import {MathigonStudioApp} from './app';
import {CourseAnalytics} from './models/analytics';
import {Classroom} from './models/classroom';
import {Progress} from './models/progress';
import {User} from './models/user';
import {CONFIG, COURSES} from './utilities/utilities';


// -----------------------------------------------------------------------------
// Dashboard Views

async function getStudentDashboard(req: express.Request, res: express.Response) {
  const progress = await Progress.getUserData(req.user!.id);
  const stats = await CourseAnalytics.getLastWeekStats(req.user!.id);
  const recent = (await Progress.getRecentCourses(req.user!.id)).slice(0, 6);
  const teachers = await Classroom.getTeachers(req.user!);

  const items = Math.min(4, 6 - recent.length);
  const recommended = COURSES.filter(x => !progress.has(x)).slice(0, items);

  res.render('dashboards/student', {progress, recent, recommended, stats, teachers});
}

async function getClassList(req: express.Request, res: express.Response) {
  const classrooms = await Classroom.find({teachers: req.user!.id}).exec();
  res.render('dashboards/teacher', {classrooms});
}

async function getClassDashboard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.redirect('/login');
  const classroom = await Classroom.lookup(req.params.code);
  if (!classroom || !classroom.isTeacher(req.user.id)) return next();

  const {studentData, courseData} = await classroom.getDashboardData();
  res.render('dashboards/teacher-class', {studentData, courseData, classroom});
}

async function getParentDashboard(req: express.Request, res: express.Response) {
  const classroom = await Classroom.findOne({teachers: req.user!.id});
  const students = classroom ? await classroom.getStudents() : [];

  const studentData = await Promise.all(students.map(async (student) => {
    const progress = await Progress.getUserData(student.id);
    const courses = (await Progress.getRecentCourses(req.user!.id)).slice(0, 6);
    return {data: student, courses, progress};
  }));

  res.render('dashboard/parent', {classroom, studentData});
}


// -----------------------------------------------------------------------------
// POST Requests

async function postJoinClass(req: express.Request, res: express.Response) {
  if (!req.user) return res.redirect('/login');

  const classroom = await Classroom.lookup(req.body.code);
  if (!classroom) return redirect(req, res, {error: 'invalidClassCode'}, '/dashboard');

  const response = await classroom.addStudent(req.user);
  return redirect(req, res, response, '/dashboard');
}

async function postRemoveStudent(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.redirect('/login');

  const classroom = await Classroom.lookup(req.params.code);
  if (!classroom || !classroom.isTeacher(req.user.id)) return next();

  if (!classroom.students.includes(req.params.student)) {
    return redirect(req, res, {error: 'removeClassCodeError'}, `/dashboard/${req.params.code}`);
  }

  classroom.students = classroom.students.filter(s => s !== req.params.student);
  await classroom.save();
  const student = await User.findOne({_id: req.params.student}).exec();
  const name = student?.fullName || 'student';
  redirect(req, res, {success: 'removeClassCode', params: [name]}, `/dashboard/${req.params.code}`);
}

async function postNewClass(req: express.Request, res: express.Response) {
  if (!req.user) return res.redirect('/login');
  if (req.user.type !== 'teacher') return res.redirect('/dashboard');

  const count = await Classroom.count({admin: req.user.id});
  if (count >= 20) return redirect(req, res, {error: 'tooManyClasses'}, '/dashboard');

  const classroom = Classroom.make(req.body.title || '', req.user);
  await classroom.save();
  return res.redirect(`/dashboard/${classroom.code}`);
}

async function postEditClass(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.redirect('/login');

  const classroom = await Classroom.lookup(req.params.code);
  if (!classroom || !classroom.isTeacher(req.user.id)) return next();

  if (req.body.title) classroom.title = req.body.title.trim();
  await classroom.save();
  return res.redirect(`/dashboard/${classroom.code}`);
}

async function postDeleteClass(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.redirect('/login');

  const classroom = await Classroom.lookup(req.params.code);
  if (!classroom || classroom.admin !== req.user.id) return next();

  await classroom.delete();
  return redirect(req, res, {success: 'classDeleted', params: [classroom.title]}, '/dashboard');
}


// -----------------------------------------------------------------------------
// Exports

function getDashboard(req: express.Request, res: express.Response) {
  if (!req.user) return res.redirect('/login');
  if (CONFIG.accounts.teachers && req.user.type === 'teacher') return getClassList(req, res);
  if (CONFIG.accounts.parents && req.user.type === 'parent') return getParentDashboard(req, res);
  return getStudentDashboard(req, res);
}

export default function setupDashboardEndpoints(app: MathigonStudioApp) {
  app.get('/dashboard', getDashboard);
  app.get('/dashboard/:code', getClassDashboard);

  app.post('/dashboard/add', postJoinClass);
  app.post('/dashboard/new', postNewClass);
  app.post('/dashboard/:code', postEditClass);
  app.post('/dashboard/:code/remove/:student', postRemoveStudent);
  app.post('/dashboard/:code/delete', postDeleteClass);
}
