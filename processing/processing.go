/*
   This a Golang version of the previous processing server. In this version,
   experiments are processed in parallel in seperate threads using consumer/producer model.
   Copyright 2017 Zahid Hossain
*/

/*
Added Fields
--------------
'exp_processingEndTime',
'exp_processingStartTime',
'exp_resortTime',
'exp_runEndTime',
'exp_runStartTime',
'proc_endPath',
'proc_err',
'proc_expSchemaJsonPath',  (not sure need anymore)
'proc_lightDataArrayPath', (not sure need anymore)
'proc_startPath'           (not sure need anymore)


Changed Fields:
---------------
'exp_status',
'proc_attempts',
'exp_metaData'
'proc_jpgFiles' (not needed anymore)

New Field Added in exp_metaData (existing fields are not changed)
------------------------------------------------------------------
{
"ExpName":"58967285a25ea31347092fe7",
"ExpFullPath":"/home/pi/bpuData/tempExpData/58967285a25ea31347092fe7.json",
"lightDataPath":"/home/pi/bpuData/tempExpData/lightdata_meta.json",
"lightDataSoapPath":"/home/pi/bpuData/tempExpData/lightdata.json",
"saveTime":"2017-02-05T00:33:08.545Z",
"numFrames":"465"
}
*/

package main

import (
	"errors"
	"fmt"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"time"
        "os/exec"
	"strconv"
	"regexp"
	"io/ioutil"
	"encoding/json"
	"math"
	"sync"
)

const (
        WORKERS int = 8
        MAXRETRIES int = 3
        ROOT string = "/Users/zhossain/work/euglenalab/processing/data/"
        BPU_PATH = ROOT + "bpuEuglenaData_forMounting/"
        FINAL_PATH = ROOT + "finalBpuData/"
        MINIMUM_JPG_FILES = 20
        DATABASE = "test"
        COLLECTION = "bpuexperiments"
	BPUCOLLECTION = "bpus"
        MOVIEEXEC = "./tools/euglenamovie"
        MOVIE_POST_PROCESS = "./tools/tracks.sh"
	MOVE_DATA = "./tools/movedata.sh"
	PYTHON_SCRIPT_ROOT = "../shared/python-scripts/"
)

type ExpUser struct {
	Id     bson.ObjectId `bson:"id,omitempty"`
	Groups []string      `bson:"groups"`
	Name   string        `bson:"name"`
}

type ExpLastResort struct {
	BPUName string `bson:"bpuName"`
}
type ExpMetaData struct {
	//ExpName             string `bson:"ExpName"`
	//ExpFullPath         string `bson:"ExpFullPath"`
	//LightDataPath       string `bson:"lightDataPath"`
	//LightDataSoapPath   string `bson:"lightDataSoapPath"`
	//SaveTime            string `bson:"saveTime"`
	NumFrames           int32  `bson:"numFrames"`
	//UserURL             string `bson:"userUrl"`
	//ClientCreationDate  string `bson:"clientCreationDate"`
	//GroupExperimentType string `bson:"group_experimentType"`
	//RunTime             int32  `bson:"runTime"`
	//Tag                 string `bson:"tag"`
	Magnification       int32  `bson:"magnification"`
}

type Experiment struct {
	Id                     bson.ObjectId `bson:"_id,omitempty"`
	ProcStartPath          string        `bson:"proc_startpath"`
	ProcEndPath            string        `bson:"proc_endPath"`
	ProcErr                string        `bson:"proc_err"`
	Status                 string        `bson:"exp_status"`
	User                   ExpUser       `bson:"user"`
	ProcAttempts           int32         `bson:"proc_attempts"`
	ExpMetaData            ExpMetaData   `bson:"exp_metaData"`
	ExpProcessingStartTime float64       `bson:"exp_processingStartTime"`
	ExpProcessingEndTime   float64       `bson:"exp_processingEndTime"`
	ExpRunStartTime        float64       `bson:"exp_runStartTime"`
	ExpRunEndTime          float64       `bson:"exp_runEndTime"`
	ExpResortTime          float64       `bson:"exp_resortTime"`
	ExpBPUName             string        `bson:"exp_wantsBpuName"`
	LastResort             ExpLastResort `bson:"exp_lastResort"`
}

type Scores struct {
	AccPopulation	float64 `bson:"scripterPopulation"`
	AccActivity     float64 `bson:"scripterActivity"`
	AccResponse     float64 `bson:"scripterResponse"`

	Population	float64 `bson:"population"`
	Activity     	float64 `bson:"activity"`
	Response     	float64 `bson:"response"`

	PopulationDate	float64 `bson:"scripterPopulationDate"`
	ActivityDate    float64 `bson:"scripterActivityDate"`
	ResponseDate    float64 `bson:"scripterResponseDate"`

	WindowLambdaMs	int32	`bson:"WindowLambdaMs"`
}

type BPU struct {
	Id		bson.ObjectId	`bson:"_id,omitempty"`
	Name		string		`bson:"name"`
	Scores		Scores		`bson:"performanceScores"`
}

type DataFolderInfo struct {
	srcFolder   string
	numJPGFiles int
	jsonData    map[string]interface{}
}

var g_numRegularExpression  *regexp.Regexp

func getQueryProjection(data interface{}) bson.M {
	//exp := Experiment{}
	st := reflect.TypeOf(data)
	queryProjection := bson.M{}
	for i := 0; i < st.NumField(); i++ {
		if bsonTag, ok := st.Field(i).Tag.Lookup("bson"); ok {
			if tokens := strings.Split(bsonTag, ","); len(tokens) > 0 {
				queryProjection[tokens[0]] = 1
			}

		}
	}
	return queryProjection
}

func getFormattedBPUName(bpuName string) (string, error) {
	if len(bpuName) < 4 {
		return "", errors.New("BPU name seems invalid: " + bpuName)
	}
	base := bpuName[:3]
	num := bpuName[3:]
	return base + "-" + num, nil
}

func getDataFolderInfo(exp *Experiment) (DataFolderInfo, error) {

	bpuName, err := getFormattedBPUName(exp.ExpBPUName)
	if err != nil {
		return DataFolderInfo{}, errors.New("getDataFolderInfo:" + err.Error())
	}

	srcFolder := BPU_PATH + bpuName + "/" + exp.Id.Hex() + "/"

	fileInfo, err := os.Stat(srcFolder)
	if err != nil {
		return DataFolderInfo{}, errors.New("getDataFolderInfo:" + err.Error())
	} else if !fileInfo.IsDir() {
		return DataFolderInfo{}, errors.New("getDataFolderInfo:" + srcFolder + " is not a directory")
	}

	jpgFiles, _ := filepath.Glob(srcFolder + "*.jpg")
	jsonMap, err := loadJSONFile(srcFolder + exp.Id.Hex() + ".json")

	if err != nil {
		return DataFolderInfo{}, errors.New("getDataFolderInfo:loadJSONFile:" + err.Error())
	}
	return DataFolderInfo{srcFolder: srcFolder, numJPGFiles: len(jpgFiles), jsonData:jsonMap}, nil
}

func compileMovie(wid int, exp *Experiment) error {
        fmt.Printf("Worker %d, Experiment ID: %s - Compiling Movie\n", wid, exp.Id.Hex())
        _, err := exec.Command(MOVIEEXEC,"-i",exp.ProcStartPath).Output()
	if err != nil {
		return errors.New("compileMovie:" + err.Error())
	}
        return err
}

func postProcessMovie(wid int, exp *Experiment) error {
        fmt.Printf("Worker %d, Experiment ID: %s - Postprocessing Movie\n", wid, exp.Id.Hex())
        _,err := exec.Command("/bin/bash", MOVIE_POST_PROCESS, exp.ProcStartPath).Output()
	if err != nil {
		return errors.New("postProcessMovie:" + err.Error())
	}
        return err
}

func moveToFinalLocation(wid int, exp *Experiment) error {
	fmt.Printf("Worker %d, Experiment ID: %s - Removing captured images\n", wid, exp.Id.Hex())
	exp.ProcEndPath = FINAL_PATH + exp.Id.Hex()
	_,err := exec.Command("/bin/bash", MOVE_DATA, exp.ProcStartPath, FINAL_PATH, exp.Id.Hex()).Output()
	if err != nil {
		return errors.New("moveToFinalLocation:" + err.Error())
	}
	return err
}

func loadJSONFile(filename string) (map[string]interface{}, error) {
	raw, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	jsonData := make(map[string]interface{})
	json.Unmarshal(raw,&jsonData)
	return jsonData, nil
}

func prepareBPUpdateFields( bpu *BPU ) bson.M {
	selectedFields := bson.M{
		"performanceScores.scripterPopulation" 	: bpu.Scores.AccPopulation,
		"performanceScores.scripterActivity"	: bpu.Scores.AccActivity,
		"performanceScores.scripterResponse"	: bpu.Scores.AccResponse,
		"performanceScores.population"		  : bpu.Scores.Population,
		"performanceScores.activity"              : bpu.Scores.Activity,
		"performanceScores.response"		: bpu.Scores.Response,
		"performanceScores.scripterPopulationDate": bpu.Scores.PopulationDate,
		"performanceScores.scripterActivityDate"  : bpu.Scores.ActivityDate,
		"performanceScores.scripterResponseDate"  : bpu.Scores.ResponseDate,
	}
	return selectedFields
}

func processScripter(wid int, exp *Experiment, session *mgo.Session) error {

	scripterName := exp.User.Name
	varName := scripterName[8:]

	fmt.Printf("Worker %d, Experiment ID: %s - Processing Scripter (%s) for BPU (%s) \n",wid,exp.Id.Hex(), varName, exp.ExpBPUName )

	pythonScript := PYTHON_SCRIPT_ROOT + scripterName + ".py"
	out,err := exec.Command("python",pythonScript,exp.ProcStartPath,strconv.Itoa(int(exp.ExpMetaData.Magnification))).Output()
	if err != nil {
		return errors.New("processScripter:" + scripterName + ":" + err.Error())
	}
	stat := g_numRegularExpression.FindString(string(out))
	if len(stat) == 0 {
		return errors.New("processScripter:" + scripterName + ":" + "Script output " + stat + " cannot be converted to number")
	}

	currStat,err := strconv.ParseFloat(stat,64)

	if err != nil {
		return errors.New("processScripter:" + scripterName + ":" + err.Error())
	}

	sessionCopy := session.Copy()
	defer sessionCopy.Close()

	collection := session.DB(DATABASE).C(BPUCOLLECTION)

	var bpu BPU
	queryProjection := getQueryProjection(bpu)
	collection.Find(bson.M{"name":exp.ExpBPUName}).Select(queryProjection).One(&bpu)

	scoreValue := reflect.ValueOf(&bpu.Scores)
	scoreValue.Elem().FieldByName(varName).SetFloat(currStat)


	var expTime float64

	if exp.ExpRunEndTime >= 0 {
		expTime = exp.ExpRunEndTime
	} else {
		return errors.New("processScripter:" + scripterName + ":" + "exp.ExpRunEndTime is negative, i.e. missing data")
	}

	lambda := float64(bpu.Scores.WindowLambdaMs)
	oldValue := scoreValue.Elem().FieldByName("Acc" + varName).Float()
	oldTime := scoreValue.Elem().FieldByName(varName + "Date").Float()
	timeDiff := expTime - oldTime

	if( timeDiff >= 0 ) {
		weight := math.Pow(2, - (timeDiff / lambda))
		newValue := (oldValue * weight + currStat) / (weight + 1.0)

		scoreValue.Elem().FieldByName("Acc" + varName).SetFloat(newValue)
		scoreValue.Elem().FieldByName(varName + "Date").SetFloat(expTime)

		fmt.Printf("Worker %d, Experiment ID: %s - Scripter (%s) Updating BPU (%s) Database (oldValue:%f,curValue:%f,cummValue:%f)\n",
			   wid, exp.Id.Hex(), varName, bpu.Name, oldValue, currStat, newValue)

		selectedFields := prepareBPUpdateFields( &bpu )
		err = collection.UpdateId(bpu.Id,bson.M{"$set":selectedFields})
	} else{
		return errors.New("processScripter:" + scripterName + ":" + "timeDiff < 0 !")
	}
	return err
}

func prepareDBUpdateFields( exp *Experiment ) bson.M {
        selectedFields := bson.M{
                "exp_processingStartTime" : exp.ExpProcessingStartTime,
                "exp_processingEndTime"   : exp.ExpProcessingEndTime,
                "exp_runStartTime"        : exp.ExpRunStartTime,
                "exp_runEndTime"          : exp.ExpRunEndTime,
                "proc_startPath"          : exp.ProcStartPath, // We dont need this, but it provides a small data for debugging :)
                "proc_endPath"            : exp.ProcEndPath,
                "proc_err"                : exp.ProcErr,
                "exp_status"              : exp.Status,
                "proc_attempts"           : exp.ProcAttempts,
                "exp_metaData.numFrames"  : exp.ExpMetaData.NumFrames,
        }
        return selectedFields
}

func makeTimeStampMillisec(t time.Time) int64 {
        return t.UnixNano() / int64(time.Millisecond)
}

func isScripter(exp *Experiment) bool {
	switch exp.User.Name {
	case "scripterPopulation", "scripterActivity", "scripterResponse":
		return true
	}
	return false
}

func fixBPUName(exp *Experiment){
	if len(exp.ExpBPUName) == 0 {
		exp.ExpBPUName = exp.LastResort.BPUName
	}
}
func processExperiment(wid int, exp *Experiment, session *mgo.Session) {
	var err error = nil

	fixBPUName(exp)

        exp.ExpProcessingStartTime = float64(makeTimeStampMillisec( time.Now() ))

        // install a cleanup function
	defer func() {
		// Based on error do something.
		var finalStatement string
		if err != nil {
			fmt.Printf("Worker %d, Error: Experiment ID: %s, Description: %s\n", wid,exp.Id.Hex(), err.Error())
			exp.ProcErr = err.Error()
			finalStatement = "FAILED"
		} else {
			exp.ProcErr = ""
                        exp.Status = "finished"
			finalStatement = "SUCCESS"
		}
		fmt.Printf("Worker %d, Experiment ID: %s - Updating Database\n", wid, exp.Id.Hex())
		sessionCopy := session.Copy()
                defer func() {
                        sessionCopy.Close()
                        fmt.Printf("Worker %d, Experiment ID: %s - Processing Complete (%s)\n", wid, exp.Id.Hex(), finalStatement)
                }()

                exp.ExpProcessingEndTime = float64(makeTimeStampMillisec( time.Now() ))
                exp.ProcAttempts++

                selectedFields := prepareDBUpdateFields(exp)
                collection := session.DB(DATABASE).C(COLLECTION)
                collection.UpdateId(exp.Id, bson.M{"$set":selectedFields})

	}()

	srcFolderInfo, err := getDataFolderInfo(exp)

	if err != nil {
		return
	}

	if srcFolderInfo.numJPGFiles < 20 {
		err = errors.New(fmt.Sprintf("processExperiment: Number of JPG files is %d, which is less than the minimum required %d",
			srcFolderInfo.numJPGFiles, MINIMUM_JPG_FILES))
		return
	}

	exp.ProcStartPath = srcFolderInfo.srcFolder
	exp.ExpMetaData.NumFrames = int32(srcFolderInfo.numJPGFiles)

	if _,ok := srcFolderInfo.jsonData["exp_runStartTime"]; ok {
		exp.ExpRunStartTime = srcFolderInfo.jsonData["exp_runStartTime"].(float64)
	} else {
		exp.ExpRunStartTime = -1
	}

	if _,ok := srcFolderInfo.jsonData["exp_runEndTime"]; ok {
		exp.ExpRunEndTime = srcFolderInfo.jsonData["exp_runEndTime"].(float64)
	} else {
		exp.ExpRunEndTime = -1
	}

	isScripter := isScripter(exp)

	var wg sync.WaitGroup
	scripterErrorChannel := make(chan error,1)

	if isScripter {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err = processScripter(wid, exp, session)
			scripterErrorChannel <- err
		}()
	}

        err = compileMovie(wid, exp)
        if err != nil {
                return
        }

	wg.Wait()
	select {
		case err = <-scripterErrorChannel:
			if err != nil {
				return
			}
		default:
	}

	if  !isScripter {
		err = postProcessMovie(wid,exp)
		if err != nil {
		        return
		}
	}

	err = moveToFinalLocation(wid,exp)
	if err != nil {
	        return
	}
}

func consume(wid int, session *mgo.Session, jobs <-chan Experiment) {
	for {
		j := <-jobs
		processExperiment(wid, &j, session)
	}
}



func enqueueExperiments(c *mgo.Collection, jobChannel chan<- Experiment) {
	var debug bool = true
	var query bson.M

	if debug {
		query = bson.M{"_id": bson.M{"$in":[]bson.ObjectId{
									bson.ObjectIdHex("5893b30e0791958622f4b59a"),
									bson.ObjectIdHex("58967285a25ea31347092fe7"),
									bson.ObjectIdHex("58967414a25ea31347092fe8"),
									bson.ObjectIdHex("588c280b0d339f983f7d6dd0"),
									bson.ObjectIdHex("5893b0e80791958622f4b597"),
									bson.ObjectIdHex("5892f701762325c36b023a2b"),
									bson.ObjectIdHex("5893a2d705db105c1f51eff7"),
									bson.ObjectIdHex("5893c5b33bec53d826502672"),
                                                                   },
                                            },
                              }

	} else {
		fromDate := bson.NewObjectIdWithTime(time.Now().AddDate(0, 0, -1))
		toDate := bson.NewObjectIdWithTime(time.Now())

		//query = bson.M{
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

	var expList []Experiment
	err := c.Find(query).
		Limit(WORKERS * 2).
		Select(getQueryProjection(Experiment{})).
		All(&expList)

	fmt.Println("Total Experiments:", len(expList))

	if err != nil {
		fmt.Println("Database Query error")
	}

	for _, e := range expList {
		jobChannel <- e
	}
}

func main() {
	//mgo.SetDebug(true)
	//var aLogger *log.Logger
	//aLogger = log.New(os.Stderr, "", log.LstdFlags)
	//mgo.SetLogger(aLogger)

	g_numRegularExpression = regexp.MustCompile(`^[-+]?[0-9]+\.[0-9]+|[0-9]+`)

	session, err := mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	defer session.Close()

	session.SetMode(mgo.Monotonic, true)
	c := session.DB(DATABASE).C(COLLECTION)

	done := make(chan bool)
	expJobChannel := make(chan Experiment)
	for w := 0; w < WORKERS; w++ {
		go consume(w, session, expJobChannel)
	}

	enqueueExperiments(c, expJobChannel)
	//ticker := time.NewTicker(time.Second * 5)
	//for t := range ticker.C {
	//        fmt.Println("Enqueue at", t)
	//        enqueueExperiments(c, expJobChannel)
	//}
	<-done
}
