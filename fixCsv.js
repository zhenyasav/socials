#!/usr/bin/env node

const https = require('https');
const placename = require('placename');
const fs = require('fs');
const path = require('path');

const getJson = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, function(res) {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(e);
        }
      })
    });
  });
}

const stripAt = (uname) => uname.startsWith('@') ? uname.substring(1) : uname;

const getTwitterFollowers = (username) => {
  username = stripAt(username.trim());
  const twitter = 'https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=' + username;
  return new Promise((resolve, reject) => {
    getJson(twitter).then((data) => {
      const followers = data[0].followers_count;
      resolve(followers);
    }, reject);
  });
}

const getInstagramFollowers = (username) => {
  username = stripAt(username.trim());
  const url = `https://www.instagram.com/${username}/?__a=1`;
  return new Promise((resolve, reject) => {
    getJson(url).then((data) => {
      const followers = data.user.followed_by.count;
      resolve(followers);
    }, reject);
  });
}

const toCsv = (matrix) => matrix.map((row) => row.join(',')).join('\n') + '\n';

const processCsv = (filename) => {
  console.log('reading', filename);
  let contents = fs.readFileSync(filename, 'utf8');
  contents = contents.replace(/\r/g, '');
  const lines = contents.split('\n');
  const promises = [];
  const output = [];
  lines.forEach((line, index) => {
    const cols = line.split(',');
    cols.forEach((col, i) => cols[i] = cols[i].trim());
    output.push(cols);
    if (index == 0) {
      return; // header
    }
    const [name, ig, igf, twit, twitf, email, city, country] = cols;
    if (!!ig && !igf) {
      console.log(name, 'needs instagram follower count');
      promises.push(new Promise((resolve, reject) => {
        getInstagramFollowers(ig).then((followers) => {
          cols[2] = followers;
          console.log(name, 'has', followers, 'followers on instagram');
          resolve();
        }, (err) => {
          console.error('could not fetch instagram followers for ', ig);
          resolve();
        });
      }));
    }
    if (!!twit && !twitf) {
      console.log(name, 'needs twitter follower count')
      promises.push(new Promise((resolve, reject) => {
        getTwitterFollowers(twit).then((followers) => {
          cols[4] = followers;
          console.log(name, 'has', followers, 'followers on twitter');
          resolve();
        }, (err) => {
          console.error('could not fetch twitter followers for ', ig);
          resolve();
        });
      }));
    }
    if (!!city && !country) {
      console.log(name, 'needs country');
      promises.push(new Promise((resolve, reject) => {
        placename(city, (err, result) => {
          if (err) return resolve();
          const r = result && result[0];
          if (r) {
            console.log(name, 'lives in', r.country);
            cols[7] = r.country;
          }
          resolve();
        })
      }));
    }
  });
  Promise.all(promises).then((data) => {
    const csv = toCsv(output);
    fs.writeFileSync(filename, csv);
    console.log('finished');
  }).catch((err) => {
    console.log('err', err);
  })
}

let filename = process.argv[2];
filename = path.resolve(filename.replace(/~/, process.env.HOME));
if (!filename) return console.error('You must specify a filename');

processCsv(filename);
