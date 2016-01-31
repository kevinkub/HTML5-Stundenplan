(function(){
	
	var URL = {};
	URL.Courses = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20data.html.cssselect%20where%20url%3D%22http%3A%2F%2Fintranet.fhdw.de%2Fical%2F%22%20and%20css%3D%22a%22%20limit%20500&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
	URL.ForCourse = function(course) {
		return "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fintranet.fhdw.de%2Fical%2F" + course + ".ics%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys";
	}
	
	var Filter = {
		Unique: function(value, index, self) {
			return self.indexOf(value) === index; 
		}
	}
	
	var instance = new Vue({
		el: 'body',
		data: {
			view: 'calendar',
			courses: [''],
			lessons: [],
			viewData: {
				calendar: {
					day: 0,
					month: 0,
					year: 0
				}
			}
		},
		methods: {
			getCourses: function () {
				return this.lessons.map(function(el){
					return el.course;
				}).filter(Filter.Unique);
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
			getLessonsByDate: function(date) {
				return this.lessons.filter(function(el){
					return el.startDate.toDateString() == date.toDateString();
				});
			},
			getLessonsForCurrentDate: function(){
				return this.getLessonsByDate(new Date(
					this.viewData.calendar.year, 
					this.viewData.calendar.month - 1, 
					this.viewData.calendar.day
				));
			},
			calendarGetNumberOfSpacers: function() {
				var day = new Date(this.viewData.calendar.year, this.viewData.calendar.month - 1, 1).getDay() - 1;
				return day == -1 ? 6 : day;
			},
			calendarGetLastDayOfMonth: function() {
				var date = new Date(this.viewData.calendar.year, this.viewData.calendar.month, 1);
				return new Date(date - 1).getDate();
			},
			getMonthNameForMonth: function(month) {
				return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][month];
			},
			getTimeStringForLesson: function(lesson) {
				function nullify(num) {
					if (num < 10) {
						return '0' + num;
					}
					return num;
				}
				return nullify(lesson.startDate.getHours())+':'+nullify(lesson.startDate.getMinutes())+' - '+ nullify(lesson.endDate.getHours())+':'+nullify(lesson.endDate.getMinutes());
			}
		},
		ready: function() {
			// Set initial calendar date
			var cal = this.viewData.calendar;
			var date = new Date();
			cal.day = date.getDate();
			cal.month = date.getMonth() + 1;
			cal.year = date.getFullYear();
			// Get all courses from ical listing
			this.$http({url: URL.Courses, method: 'get'}).then(function (response) {
				if(response && response.data && response.data.query && response.data.query.results && response.data.query.results.results && response.data.query.results.results.a) {
					var data = response.data.query.results.results.a
						.filter(function( el ){ return el.href.indexOf('.ics') != -1 })
						.map(function( el ){ return el.href.replace(".ics", ""); });
					this.$set('courses', data);
				}
			}, function (response) {
				// error
			});
			// Get a single course from ical directory
			this.$http({url: URL.ForCourse("pfbw116a"), method: 'get'}).then(function (response) {
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
					this.$set('lessons', events);
				}
			}, function (response) {
				// error
			});
		}
	});
	
})();