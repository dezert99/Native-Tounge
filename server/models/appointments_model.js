const sql = require("../database");
const _ = require("lodash");
const { isNull } = require("lodash");
var nodemailer = require('nodemailer'); 
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  }
});

function grabSQLData(sqlstr, params){
  return new Promise((resolve, reject) => {
    sql.query(sqlstr, params, (err, res) => {
      if (err) {
        reject(err);
      }
  
      return resolve(res);
    })
  })
}

const Appointment = function(appointment) {
  this.id = appointment.id;
  this.timeStart = appointment.timeStart;
  this.timeEnd = appointment.timeEnd;
  this.description = appointment.description;
  this.translatorUserId = appointment.translatorUserId;
  this.applicantUserId = appointment.applicantUserId;
  this.status = appointment.status;
  this.location = appointment.location;
};

Appointment.create = (appointment, result) => {
    sql.query("INSERT INTO appointments SET time_start = (STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s')), time_end = (STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s')), description =?, translator_user_id = ?, applicant_user_id=?, status=?, location=?", [appointment.timeStart, appointment.timeEnd, appointment.description, appointment.translatorUserId, appointment.applicantUserId ? appointment.applicantUserId : -1, appointment.status, appointment.location], (err, res) => {
      if (err) {
        console.log("error in appointment model: ", err);
        result(err, null);
        return;
      }
  
      console.log("created appointment: ", { id: res.insertId, ...appointment });
      result(null, { id: res.insertId, ...appointment });
    });
};

Appointment.getAll = result => {
  sql.query("SELECT * FROM appointments", (err, res) => {
    if (err) {
      console.log("error in appointments model getAll: ", err);
      result(null, err);
      return;
    }

    console.log("appointments: ", res);
    result(null, res);
  });
};

Appointment.getApplicantAppointments = async (applicantID,result) => {
  let userInfo = await grabSQLData("SELECT * FROM users WHERE user_id=?",[applicantID]) ;
  let languages = userInfo[0]["languages"].replace(" ","").split(",");
 console.log("languages ", languages);
  let translatorIds = []
  let justIds = []
  for(let i = 0; i < languages.length; i++) {
    let resp = await grabSQLData("SELECT * FROM language WHERE language=?",[languages[i]]);
    if(!justIds.includes(resp.user_id)) {
      translatorIds.push(...resp);
    }
    justIds.push(resp.user_id)

  }
  let pending_accepted = [];
  let open = [];
  let appointments = []
  let all = {};
 console.log("translatorIds ", translatorIds);

  for(let i = 0; i < translatorIds.length; i++){
    appointments = await grabSQLData("SELECT * FROM appointments WHERE translator_user_id=? AND (status!='reserved' OR applicant_user_id=?)", [translatorIds[i].user_id,applicantID])
    .catch(err => {
      console.log("error in appointments model getAPlicantScheduled: ", err);
      result(null, err);
      return;
    });
    if(!_.isEmpty(appointments)){
      for(let i = 0; i< appointments.length; i++) {
        let appointment = appointments[i];
        console.log("app", appointment, appointment["translator_user_id"]);
        let translatorData = await grabSQLData("SELECT first_name, last_name FROM users WHERE user_id = ?",[appointment["translator_user_id"]]);
        appointment["translator"] = translatorData[0];
        console.log("app after", appointment);
        if(appointment.status === "reserved" || appointment.status === "pending"){
          pending_accepted.push(appointment);
        }
        else {
          open.push(appointment);
        }
        all[appointment.appointment_id] = appointment;
      }
    }
  }
  result(null, {
    open: open,
    pending_accepted: pending_accepted,
    all: all
  });
};

Appointment.getTranslatorAppointments = async (translatorID,result) => {
  sql.query("SELECT * FROM appointments WHERE translator_user_id=?", [translatorID], async (err, res) => {
    if (err) {
      console.log("error in appointments model getAPlicantScheduled: ", err);
      result(null, err);
      return;
    }
    let pending_accepted = [];
    let open = [];
    let all = {};

    for(let i = 0; i< res.length; i++) {
      let appointment = res[i];
      console.log("app", appointment, appointment["translator_user_id"]);
      let translatorData = await grabSQLData("SELECT first_name, last_name FROM users WHERE user_id = ?",[appointment["translator_user_id"]]);
      appointment["translator"] = translatorData[0];
      console.log("app after", appointment);
      if(appointment.status === "reserved" || appointment.status === "pending"){
        pending_accepted.push(appointment);
      }
      else {
        open.push(appointment);
      }
      all[appointment.appointment_id] = appointment;
  }
    
    console.log("appointments: ", res);
    result(null, {
      open: open,
      pending_accepted: pending_accepted,
      all: all
    });
  });
};

async function sendEmail(userId,subject ,content) {
  let email = await grabSQLData("SELECT email FROM users WHERE user_id=?",[userId]);
  email = email[0].email;

  var mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: subject,
    html: content
  }
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  }); 
}

Appointment.requestSlot =  (async (appointmentId, reason, userId, result) => {
  console.log(process.env.EMAIL, process.env.EMAIL_PASS)
  

  let translatorId = await grabSQLData("SELECT translator_user_id FROM appointments WHERE appointment_id=?", [appointmentId])
  .catch(err => {
    console.log("error in appointments model getAPlicantScheduled: ", err);
    result(null, err);
    return;
  });

  translatorId = translatorId[0].translator_user_id;
  console.log("translatorId", translatorId);

  let template = `<h2 style="text-align: center">You have a new pending appointment!</h2> <p style="text-align: center"> Please <a href="http://localhost:3000">log in</a> to view it<p>`;

  sendEmail(translatorId, 'You have a new pending appointment', template);

  sql.query("UPDATE appointments SET applicant_user_id=?, description=?, status='pending' WHERE appointment_id=?", [userId, reason, appointmentId], (err, res) => {
    if (err) {
      console.log("error in appointments model requestSlot: ", err);
      result(null, err);
      return;
    }

    console.log("appointments: ", res);
    result(null, res);
  });
})

Appointment.cancelReservation = ((appointmentId, result) => {
  sql.query("UPDATE appointments  SET applicant_user_id=?, description=?, status='open' WHERE appointment_id=?", [null,null, appointmentId], (err, res) => {
    if (err) {
      console.log("error in appointments model cancelReservation: ", err);
      result(null, err);
      return;
    }

    console.log("appointments: ", res);
    result(null, res);
  });
})

Appointment.respondToRequest = ((appointmentId, newStatus, result) => {
  sql.query("UPDATE appointments  SET  status=? WHERE appointment_id=?", [newStatus,appointmentId], (err, res) => {
    if (err) {
      console.log("error in appointments model acceptRequest: ", err);
      result(null, err);
      return;
    }

    console.log("appointments: ", res);
    result(null, res);
  });
})

Appointment.bylanguage = async (language,uid, result) => {
  let ids = await grabSQLData("SELECT * FROM language WHERE language=?",[language]) 
  let resp = [];
  console.log("ids", ids);
  for(let i = 0; i < ids.length; i++){
    let val = await grabSQLData("SELECT * FROM appointments WHERE translator_user_id=? AND (status!='reserved' OR applicant_user_id=?)", [ids[i].user_id,uid]).catch(err => {
      console.log("error in appointments model getAPlicantScheduled: ", err);
      result(null, err);
      return;
    });
    if(!_.isEmpty(val)){
      console.log("val",val);
      resp.push(val);
    }
  }
  console.log("resp",resp[0]);
  result(null, resp[0]);
}

Appointment.remove = (id, result) => {
    sql.query("DELETE FROM appointments WHERE appointment_id = ?", id, (err, res) => {
      if (err) {
        console.log("error: ", err);
        result(null, err);
        return;
      }
  
      if (res.affectedRows == 0) {
        result({ kind: "not_found" }, null);
        return;
      }
  
      console.log("deleted appointment with id: ", id);
      result(null, res);
    });
  };

  Appointment.update = (appointment, result) => {
    console.log("apt",appointment);
    sql.query("UPDATE appointments SET time_start = ?, time_end = ?, description =?, translator_user_id = ?, applicant_user_id=?, status=?, location=? WHERE appointment_id=?", [appointment.timeStart, appointment.timeEnd, appointment.description, appointment.translatorUserId, appointment.applicantUserId ? appointment.applicantUserId : -1, appointment.status, appointment.location, appointment.id], (err, res) => {
      if (err) {
        console.log("error: ", err);
        result(null, err);
        return;
      }
  
      if (res.affectedRows == 0) {
        result({ kind: "not_found" }, null);
        return;
      }
  
      console.log("updated appointment with id: ", appointment.id);
      result(null, res);
    });
  };

  module.exports = Appointment;