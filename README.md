#The CSS Variable Shim

Allows you to write variables into your css.

Very easy to use. All you need to do is define variables at the top of a css file like so.

###CSS Variable Shim Variable

`/*@MyFavColor:rgb(1,25,240)*/`

Then use it later in your style sheet.

###CSS Class

`.fav-button{
background-color:rgb(0,0,0)/*@MyFavColor*/;
}`

please note in the snippet above 'rgb(0,0,0)' is used as a backup.

the only thing you have to write in script is below.

###Script

`setStyleFiles();`

Man this is easy. Goal is not only to be easy but to make your application themeable.
It is very simple using the following JavaScript to change a variable on the fly.

###Script

`swapAProperty({ selectorName: '@MyFavColor', property: 'rgb(20,170,20)' }, true);`

embed that code into a clickable object and now your application has themeing ability.

take a look at https://cssvariableshim.azurewebsites.net and try it out there.
