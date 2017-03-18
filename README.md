# Log Plumber

A hackable regular expression framework for log parsing into hierarchichal formats.

// TODO: put gif of what it does here

## Quick Start

Make sure you have `electron` and your `node` environment setup correctly before installing.

```
$ git clone https://github.com/MegaJ/Log-Plumber.git
$ cd Log-Plumber
$ npm install

# If you want to run from source code
$ electron .

# If you want to build an executable (tested on linux so far only)
# output folder is release-builds
$ npm run pkg
```

### Example Workflow

1. You paste in some input text
2. You specify what a log unit looks like and give your regular expression a global flag.
3. You add regular expressions to parse the unit of log matched by the regular expression in step 2.
4. You specify the rest of the levels like step 3.
5. During steps 2 - 4, output is generated dynamically as a tree

Log Plumber should be adaptable your favorite input formats from syslogd, ssh, sshd or log files at your work place.

#### Vocabulary

* Level: A regular expression specifying the type of text which should appear as output in the same level of the log tree. Levels start from 0 visually at the top, and  each level below counts upward (0, 1 , 2...)

* Log Unit: A match on the input log created by a regular expression with an active global flag.




## Regular Expression Usage

### Levels

Log Plumber creates levels across multiple log units. For example if the input text looks like

``` 
Mar  8 03:48:05 avas dbclean[13362]: 1.2.32 cleaning dcc_db
Mar  8 03:48:05 avas dccd[13284]: database cleaning begun
Mar  8 03:50:40 avas dbclean[13362]: expired 3741033 records and 10305510 checksums in /home/dcc/dcc_db
Mar  8 03:51:27 avas dbclean[13362]: hashed 8238442 records containing 17108406 checksums, compressed 1272157 records
```

You would be able to group everything that happens after `cleaning dcc_db` under a level, *L1*. There is no restriction for matched text to strictly reside within the same log unit.

If you wish to have multiple types of matches be at *L1*, you will have to logically OR your regular expression matching `cleaning dcc_db` with another expresssion matching your other desired match.

### Outputted Text
Outputted text from a regular expression reflects only the deepest level capture group of the regular expression. (TODO: I could allow all capture groups to be processed) 
* Example: A regular expression `ERROR: ([\s\S]*)` will output the text in a log unit from whatever happens after the text "Error: ". Thus if the input text is "ERROR: System failure", then "System failure" will show up on the corresponding tree level.

### Scoped Text
Similarly, a regular expression *R1* scoping text for a regular expression *R2* which immediately follows *R1*, will scope using the match from its deepest capture group.

### Options


* `/u` is always used so feel free to parse unicode
* `/g` creates a context for the subsequent levels to match against. A level with this flag activated will not output anything on its level. It is recommended to turn this flag on for the regular expression at level 0. Note that a lot of `/g` levels potentially increases the time complexity of your parsing by factor `n = # of log units`. (There is essentially a nested for-loop for each regular expression marked with `/g`) 
* `/i` and `/m` are as you'd expect

## Features
	
### Table of Contents
 
**[Scoping](#scoping)**  
**[Linkage](#linkage)**     
**[Key mappings](#keymappings)**      
**[Creating custom tree builders](#Creating-custom-tree-builders)**  
**[Going Forward](#next-steps)**  


### Linkage

#### Creation / Deletion

Drag the mouse over multiple unicode chain glyphs.

#### Description

A regular expression may be part of a linkage. A linkage is a collection of contiguous regular expressions. Linkages affect the output by requiring log units to match each regular expression within the linkage. Otherwise, the text will not be committed to the output.

No linkage may overlap one another.



### Key mappings
Global:
* `Ctrl + f` Cross window text search. `Ctrl + ENTER` for finding the next match when the find widget is in focus.
* `F5` Run matches for the regular expressions

With focus on a text box for inputting regular expressions:
* `Alt + Up` Swap the level with the level above.
* `Alt + Down` Swap the level with the level below.

### Creating custom tree builders (Not Yet)

You can add your own custom tree builders by writing a javascript module.

### Sound Effects
Because business facing applications should have sound effects.

### Going Forward
* Add ability to save regexps and settings
* Add ability to load regexps and settings
* Minibuffer, so we can have emacs-esque bindings
* Pretty up side nav
* Write examples
* Make gifs for visual tutorials
* General linkage feature improvements
 	* Merge linkages
 	* Visually keep linkages at the same level even when swapping
* Use self-balancing trees for some data structures
* Refactor to modularize renderer.js
* Use a red-black tree (or a stack..?) for persistence when allowing undo history
* Implement Watch feature to watch a certain file for updates
* Tree Diffing between runs of Log Plumber to update only the portions needed.
* Fix find widget bugs
* create a command line utility
* put project on npm
* Integrate gulp as a build system, because `require` takes startup time. Minify and uglify things
* Getting releases out

## License
Afferro GPL V3
