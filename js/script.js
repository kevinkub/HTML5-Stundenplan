(function(){
	
	var URL = {};
	URL.Courses = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fintranet.fhdw.de%2Fical%2F%22%20and%20xpath%3D%22.%2F%2Fa%22%20limit%20500&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
	URL.ForCourse = function(course) {
		return "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fintranet.fhdw.de%2Fical%2F" + course + ".ics%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
	}
	
	var Filter = {
		Unique: function(value, index, self) {
			return self.indexOf(value) === index; 
		}
	}
	
	var Cache = {
		Courses: JSON.parse(localStorage.getItem("courses") || '[""]'),
		Lessons: JSON.parse(localStorage.getItem("lessons") || '[]'),
		SetCourses: function(courses){
			localStorage.setItem("courses", JSON.stringify(courses));
		},
		SetLessons: function(lessons){
			localStorage.setItem("lessons", JSON.stringify(lessons));
		},
		LastRefresh: localStorage.getItem("lastRefresh") || "Noch nie."
	};
	// Fix dates
	Cache.Lessons.forEach(function(el){
		el.startDate = new Date(el.startDate);
		el.endDate = new Date(el.endDate);
	});
	
	var instance = new Vue({
		el: 'body',
		data: {
			view: 'calendar',
			courses: Cache.Courses,
			lessons: Cache.Lessons,
			lastRefresh: Cache.LastRefresh,
			course: localStorage.getItem("course"),
			viewData: {
				calendar: {
					currentDate: new Date()
				}
			}
		},
		computed: {
			dayMap: function () {
				var map = {};
				this.lessons.forEach(function(lesson){
					var key = lesson.startDate.toDateString();
					if(!map[key]) { 
						map[key] = [];
					}
					map[key].push(lesson);
				});
				return map;
			},
			courseNames: function() {
				return this.lessons.map(function(el){
					return el.course;
				}).filter(Filter.Unique).sort(function(a, b){
					if(a < b) return -1;
					if(a > b) return 1;
					return 0;
				});
			}
		},
		methods: {
			getCourses: function () {
				return this.courseNames;
			},
			getSubscribersByCourse: function(course) {
				return this.getLessonsForCourse(course).map(function(el){
					return el.subscriber;
				}).filter(Filter.Unique).join(", ");
			},
			getLessonsForCourse: function(course) {
				return this.lessons.filter(function(el){
					return el.course == course;
				});
			},
			getProgressForCourse: function(course) {
				var now = new Date();
				var data = this.getLessonsForCourse(course).map(function(el){
					return { 
						duration: el.endDate - el.startDate, 
						finished: el.endDate < now
					};
				});
				var finished = data.filter(function(el){
					return el.finished;
				}).map(function(el){
					return el.duration;
				});
				finished = finished.length > 0 ? finished.reduce(function(old, dur){
					return old + dur;
				}) : 0;
				var unfinished = data.filter(function(el){
					return !el.finished;
				}).map(function(el){
					return el.duration;
				});
				unfinished = unfinished.length > 0 ? unfinished.reduce(function(old, dur){
					return old + dur;
				}) : 0;
				return Math.round(100 * (finished / (finished + unfinished)));
			},
			getLessonsByDate: function(date) {
				window.y = this;
				return this.dayMap[date.toDateString()] || [];
			},
			getLessonsForCurrentDate: function(){
				return this.getLessonsByDate(this.viewData.calendar.currentDate);
			},
			getColorForCourseName: function(name){
				var colorIndex = this.getCourses().indexOf(name);
				var colors = ["#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e", "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#2c3e50", "#f1c40f", "#e67e22", "#e74c3c", "#95a5a6", "#f39c12", "#d35400", "#c0392b", "#bdc3c7", "#7f8c8d"];
				return colors[colorIndex % (colors.length - 1)];
			},
			calendarGetNumberOfSpacers: function(date) {
				var date = new Date(date);
				date.setDate(1)
				var day = date.getDay() - 1;
				return day == -1 ? 6 : day;
			},
			calendarGetLastDayOfMonth: function(date) {
				var date = new Date(date.getFullYear(), date.getMonth() + 1, 1);
				return new Date(date - 1).getDate();
			},
			calendarGetMonthName: function(date) {
				return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][date.getMonth()];
			},
			calendarGetMonthsToRender: function() {
				var months = [];
				for(var i = -12; i < 12; i++) {
					var date = new Date();
					date.setDate(1);
					date.setMonth(date.getMonth() + i);
					months.push(date);
				}
				return months;
			},
			calendarGetDayInMonth: function(date, day) {
				var date = new Date(date);
				date.setDate(day);
				return date;
			},
			calendarGetDaysInMonth: function(date) {
				var days = [];
				for(var i = 1, j = this.calendarGetLastDayOfMonth(date); i <= j; i++) {
					days.push(this.calendarGetDayInMonth(date, i));
				}
				return days;
			},
			calendarIsCurrentDate: function(date){
				return this.viewData.calendar.currentDate.toDateString() == date.toDateString();
			},
			getTimeStringForLesson: function(lesson) {
				function nullify(num) {
					if (num < 10) {
						return '0' + num;
					}
					return num;
				}
				return nullify(lesson.startDate.getHours())+':'+nullify(lesson.startDate.getMinutes())+' - '+ nullify(lesson.endDate.getHours())+':'+nullify(lesson.endDate.getMinutes());
			},
			courseChanged: function(){
				localStorage.setItem("course", this.course);
				this.loadTimeTable();
			},
			loadTimeTable: function(){
				// Get a single course from ical directory
				this.$http({url: URL.ForCourse(this.course), method: 'get'}).then(function (response) {
					if(response && response.data && response.data.query && response.data.query.results && response.data.query.results.body) {
						var icalData = response.data.query.results.body;
						var jcalData = ICAL.parse(icalData);
						var vcalendar = new ICAL.Component(jcalData);
						var events = vcalendar.getAllSubcomponents('vevent');
						events = events.map(function(event){
							var summary = event.getFirstPropertyValue('summary');
							var location = event.getFirstPropertyValue('location');
							var startDate = event.getFirstPropertyValue('dtstart').toJSDate();
							var endDate = event.getFirstPropertyValue('dtend').toJSDate();
							summary = summary.replace(location, "");
							summary = summary.trim();
							if(summary.indexOf("E-Learning") != -1) {
								summary = summary.replace("E-Learning", "");
								location = "E-Learning " + location;
							}
							if(location.substr(0, 1) == "_") {
								location = location.substr(1);
							}
							var parts = summary.split(" ");
							var subscriber = parts.pop();
							var course = parts.join(" ");
							return {
								summary: summary,
								course: course,
								subscriber: subscriber.replace(",", ", "),
								location: location.replace(",", ", "),
								startDate: startDate,
								endDate: endDate
							};
						}).filter(function(event){
							if(event.course.indexOf("*") != -1) return false;
							if(event.location != "") return true;
							if(event.summary.search(/[A-Z]{3,}/) != -1) return true;
							return false;
						}).sort(function(a, b){
							if(a.startDate > b.startDate) return 1;
							if(a.startDate < b.startDate) return -1;
							return 0;
						});
						Cache.SetLessons(events);
						this.$set('lessons', events);
						var date = new Date();
						var refreshTime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
						localStorage.setItem("lastRefresh", refreshTime);
						this.$set('lastRefresh', refreshTime);
					}
				}, function (response) {
					// error
				});
			}
		},
		ready: function() {
			// Set initial calendar date
			var cal = this.viewData.calendar;
			var date = new Date();
			cal.day = date.getDate();
			cal.month = date.getMonth() + 1;
			cal.year = date.getFullYear();
			// Load time table
			if(this.course) {
				this.loadTimeTable();
			}
			// Get all courses from ical listing
			this.$http({url: URL.Courses, method: 'get'}).then(function (response) {
				if(response && response.data && response.data.query && response.data.query.results && response.data.query.results.results && response.data.query.results.results.a) {
					var data = response.data.query.results.results.a
						.filter(function( el ){ return el.href.indexOf('.ics') != -1 })
						.map(function( el ){ return el.href.replace(".ics", ""); });
					Cache.SetCourses(data);
					this.$set('courses', data);
				}
			}, function (response) {
				// error
			});
			// Setup swiping
			window.swipe = new Swipe(document.getElementById('calendar'), {
				startSlide: 12,
				continuous: false
			});
			// Setup fastclick
			if(!window.cordova) {
				if ('addEventListener' in document) {
					document.addEventListener('DOMContentLoaded', function() {
						FastClick.attach(document.body);
					}, false);
				}
			}
			// Fix dark shaddows on clicks
			document.addEventListener("touchstart", function(){}, true);
		}
	});
	
	instance.$watch('course', function (val) {
		console.log(this.courseNames, val);
		if(this.courses.indexOf(val) != -1) {
			this.courseChanged();
		}
	});
	
})();
