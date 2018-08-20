function print(x){
    console.log(x);
}

var test= ['foo', 'bar', 'foo-bar'];
print.apply(null, test);