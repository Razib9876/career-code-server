const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 3000
require('dotenv').config()


app.use(cors({
    origin:['http://localhost:5173'],
    credentials:true
}));
app.use(express.json());
app.use(cookieParser())
const logger = (req, res, next)=>{
    console.log('inside the logger middleware');
    next();
}

const verifyToken = (req, res, next)=>{
    const token = req?.cookies?.token;
    console.log('cookie in the middleware', token);

    if(!token){
        return res.status(401).send({message:'unauthorized acsess'})
    }


    // verify token
    jwt.verify(token,process.env.JWT_ACCESS_SECRET,(err, decoded)=>{
        if(err){
            return res.status(401).send({message:'unauthorized access'})
        }
        req.decoded=decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.3frxmfw.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const database = client.db("jobsdb");
        const jobsCollection = database.collection('jobs')
        const applicationsCollections = database.collection('applications')


        await client.connect();

        app.get('/jobs/applications', async (req, res) => {
            const email = req.query.email;
            const query = { hr_email: email };
            const jobs = await jobsCollection.find(query).toArray()
            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() }
                const application_count = await applicationsCollections.countDocuments(applicationQuery)
                job.application_count = application_count;
            }
            res.send(jobs)
        })

        // ✅ POST: Add New Job
        app.post("/jobs", async (req, res) => {

            const job = req.body;

            // Validation check
            if (!job.title || !job.company || !job.hr_email) {
                return res.status(400).send({ message: "Missing required fields" });
            }

            // Insert job into database
            const result = await jobsCollection.insertOne(job);
            res.status(201).send({
                success: true,
                message: "Job added successfully",
                insertedId: result.insertedId,
            });
        }
        );

        app.post('/jobs', async (req, res) => {
            const newJob = req.body
            const result = await jobsCollection.insertOne(newJob)
            res.send(result)
        })

        app.get('/jobs', async (req, res) => {
            const email = req.query.email
            const query = {};
            if (email) {
                query.hr_email = email;
            }
            const cursor = jobsCollection.find(query)

            const result = await cursor.toArray();
            res.send(result);
        })




        app.get("/jobs/:id", async (req, res) => {

            const id = req.params.id;
            const job = await jobsCollection.findOne({ _id: new ObjectId(id) });

            if (!job) {
                return res.status(404).send({ message: "Job not found" });
            }

            res.send(job);

        });

        app.get('/applications', logger,verifyToken, async (req, res) => {
            const email = req.query.email

            if(email !== req.decoded.email){
                return res.status(403).send({message:'forbidden access'})
            }

            // console.log('inside aapplications api', req.cookies)
            const query = {
                email: email
            }
            const result = await applicationsCollections.find(query).toArray()
            res.send(result)
        })

        app.post('/applications', async (req, res) => {

            const application = req.body;

            // ✅ Apply করার সময় date save
            application.appliedDate = new Date();

            // ✅ User-এর photo optional, থাকলে ধরে নেবে, না থাকলে default দেবে
            application.photoURL =
                application.photoURL ||
                "https://cdn-icons-png.flaticon.com/512/847/847969.png";

            const result = await applicationsCollections.insertOne(application);
            res.send(result);
        })

        app.get("/applicants/:jobId", async (req, res) => {
            const jobId = req.params.jobId;
            const query = { jobId: jobId };
            const result = await applicationsCollections.find(query).toArray();
            res.send(result);
        });


        app.post('/jwt', async(req, res)=>{
            const userData = req.body;
            const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET,{expiresIn:'1d'})
            
            res.cookie('token',token,{
                httpOnly:true,
                secure:false
            })
            res.send({success:true})
        })




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
