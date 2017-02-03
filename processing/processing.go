/*
   This a Golang version of the previous processing server. In this version,
   experiments are processed in parallel in seperate threads using consumer/producer model.
   Copyright 2017 Zahid Hossain
*/
package main

import (
	"fmt"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"time"
)

const WORKERS int = 8
const MAXRETRIES int = 3

type ExpUser struct {
	Id     bson.ObjectId `bson:"id,omitempty"`
	Groups []string      `bson:"groups"`
	Name   string        `bson:"name"`
}
type Experiment struct {
	Id        bson.ObjectId `bson:"_id,omitempty"`
	Startpath string        `bson:"proc_startPath"`
	EndPath   string        `bson:"proc_endPath" json:"proc_endPath`
	Status    string        `bson:"exp_status"`
	User	  ExpUser	`bson:"user"`
}



func consume(id int, jobs <-chan Experiment) {
	for {
		j := <-jobs
		fmt.Println("worker", id, "finished job", j)
		time.Sleep(10)
	}
}

func enqueueExperiments(c *mgo.Collection, jobChannel chan<- Experiment) {
	var debug bool = false
	var query bson.M

	if debug {
		query = bson.M{"_id": bson.ObjectIdHex("574608c0cb94cc6972d2b2b4")}
	} else {
		fromDate := bson.NewObjectIdWithTime(time.Now().AddDate(0, 0, -1))
		toDate := bson.NewObjectIdWithTime(time.Now())
		// query = bson.M{
		//  "_id":               bson.M{"$gte": fromDate, "$lte": toDate},
		//  "proc_doNotProcess": false,
		//  "exp_status":        "servercleared",
		//  "proc_attempts":     bson.M{"$lte": MAXRETRIES},
		// }

		query = bson.M{
			"_id":               bson.M{"$gte": fromDate, "$lte": toDate},
			"proc_doNotProcess": false,
		}
	}

	PROJECTION := bson.M{"proc_startPath": 1, "exp_status": 1, "exp_attempts": 1, "proc_endPath": 1, "user": 1}

	var expList []Experiment
	err := c.Find(query).
		Limit(WORKERS * 2).
		Select(PROJECTION).
		All(&expList)

	if err != nil {
		fmt.Println("Database Query error")
	}
	fmt.Println("Total Experiments:", len(expList))
	for _, e := range expList {
		jobChannel <- e
	}
}

func main() {
	//mgo.SetDebug(true)
	//var aLogger *log.Logger
	//aLogger = log.New(os.Stderr, "", log.LstdFlags)
	//mgo.SetLogger(aLogger)

	session, err := mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	defer session.Close()

	session.SetMode(mgo.Monotonic, true)
	c := session.DB("test").C("bpuexperiments")

	expJobChannel := make(chan Experiment)
	for w := 0; w < WORKERS; w++ {
		go consume(w, expJobChannel)
	}

	ticker := time.NewTicker(time.Second * 1)
	for t := range ticker.C {
		fmt.Println("Enqueue at", t)
		enqueueExperiments(c, expJobChannel)
	}
}
