(function(){


function clearInput(){
    $('#dots ul li').remove();
}

function authorize(code){
    if(code.length !=4 ){
        $('#rawout').html('no code')
        return;
    }
    var id = (new URL(location.href)).searchParams.get('id')
    var k= (new URL(location.href)).searchParams.get('k')
    console.log('authorize')
    $.ajax({
        url: "https://us-central1-brother-nft.cloudfunctions.net/harmony-authenticate/",
        method:'GET',
        data:{
            id:id,
            code:code,
            f:'a',
            k:k
        }}).always(function(content) {
            $('#rawout').append(content.responseText);
        })
}

$('#numpad ul li').not('.back,.ok').click(function(){
    var content = this.outerHTML;
    var totalDots = $('#dots ul li').length
    if (totalDots < 4){
        var dots = $('#dots ul')
        dots.append(content)
    }
    $('#rawout').append(content);
});

$('.back').click(function(){
    var dots = $('#dots ul li')
    if (dots.length > 0){
        dots.last().remove();
    }
});


$('#cancel').click(clearInput)

$('.ok').click(function(){
    //Only keep the ints
    var content = $('#dots ul').text().replace(/\D/g,'');
    clearInput();
    $('#rawout').html(content)
    authorize(content);
});



})();