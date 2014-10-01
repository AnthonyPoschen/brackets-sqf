// first go program.
// scrapes bohemias website to get docs for the brackets-sqf plugin.
// many concurrency problems that could be easily fixed and more highly readable code. but
// hey first program in the language just wanted it to work so w/e. ill eventually shake my c/c++ ways
// once i get my head around no classes and inheritance properly and fully embrace the power of interfaces.
// and yes im aware im using a go routine to do the task that should be run in parrell and not in one goroutine.
// i just didnt wanna feel like i was putting 0 effort into learning to be concurrent lol. that and i thought
// well if i go to the effort to be cool then i have to make sure its in a-z order by name. and that made me go. meh
// cbf ill just write my doco while it runs since ill have extra time. and apparently it took a while so this is
// pretty long. so maybe i should have put the effort in. lesson learned.
package main

import (
	"fmt"
	"log"
	"io/ioutil"
	"encoding/json"

	//"github.com/PuerkitoBio/gocrawl"
	"github.com/PuerkitoBio/goquery"
)
/*
type note struct {
	author 	string
	desc 	string
	date 	string
}
*/
type syntax struct {
	Syntax string
	Params string
	Return string
}
type sqfinfo struct {
	Name 		string
	Desc 		string
	Syn			syntax
	Examples 	[]string
	//notes 		*note
	Additional 	[]string
}


func scrape(ch chan sqfinfo, keys []string){
	for i := range keys {
		query, err := goquery.NewDocument("https://community.bistudio.com/wiki/" + keys[i])
		if err != nil {
			log.Fatal(err)
		}
		var sqf sqfinfo
		sqf.Name = keys[i]
		query.Find("body .mw-body .mw-content-ltr ._description dl").Each(func(i int, s *goquery.Selection){
			switch i {
			case 1:
				sqf.Desc = s.Find("dd").Text()
			case 2: // for every dd setup the syntax array
				syn := syntax{}
				count := len(s.Find("dd").Nodes)
				s.Find("dd").Each(func(i int, s *goquery.Selection){
					switch i {
						case 0: syn.Syntax = s.Text()
						case 1: if count == 3 {syn.Params = s.Text();} else {syn.Return = s.Text();}
						case 2: syn.Return = s.Text()
					}
				})
				sqf.Syn = syn
			case 3:// examples push array of dd.
				s.Find("dd").Each(func(i int, s *goquery.Selection){
					sqf.Examples = append(sqf.Examples,s.Text())
				})
			case 4: //additional info
				s.Find("dd a").Each(func(i int, s *goquery.Selection){
					sqf.Additional = append(sqf.Additional,s.Text())
				})
			case 5: // notes
				// not using atm
			}
		})
		ch <- sqf
		fmt.Println(keys[i])
	}
	close(ch)
}

func main() {
	query, err := goquery.NewDocument("https://community.bistudio.com/wiki/Category:Scripting_Commands_Arma_3")
	if err != nil {
		log.Fatal(err)
	}
	keywords := make([]string,0)

	query.Find("body .mw-body .mw-content-ltr table tbody tr td ").Each(func(i int, s *goquery.Selection) {
		s.Find("ul li a").Each(func(i int, s *goquery.Selection){
			keywords = append(keywords,s.Text())
		})
	})
	// chop out the section we dont want information for.
	index := -1
	for p,v := range keywords {
		if v == "abs" {
			index = p
			break
		}
	}
	if index == -1 {return}
	keywords = keywords[index:]

	ch := make(chan sqfinfo,len(keywords))
	go scrape(ch,keywords)
	sqflist := []sqfinfo{}

	for i := range ch {
		sqflist = append(sqflist,i)
	}
	b,err :=json.Marshal(sqflist)
	ioutil.WriteFile("docs.json",b,0x777)
}
