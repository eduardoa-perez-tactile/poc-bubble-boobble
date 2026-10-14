// Run inside the pinned upstream module (cmd/port-audio). Uses its unchanged YM reader.
package main
import (
 "bubblebobble/internal/ym"
 "encoding/binary"
 "fmt"
 "io"
 "os"
)
func main() {
 for i:=1;i<=5;i++ {
  path:=fmt.Sprintf("resources/audio/bubble-%d.ym",i)
  data,err:=os.ReadFile(path); if err!=nil {panic(err)}
  stream,err:=ym.New(data,false); if err!=nil {panic(err)}
  pcm,err:=io.ReadAll(io.LimitReader(stream,48000*4*600)); stream.Close(); if err!=nil {panic(err)}
  if len(pcm)>=48000*4*600 {panic("YM exceeds export safety bound")}
  file,err:=os.Create(fmt.Sprintf("%s/music-bubble-%d.wav",os.Args[1],i));if err!=nil {panic(err)}
  file.Write([]byte("RIFF"));binary.Write(file,binary.LittleEndian,uint32(len(pcm)+36));file.Write([]byte("WAVEfmt "))
  binary.Write(file,binary.LittleEndian,uint32(16));binary.Write(file,binary.LittleEndian,uint16(1));binary.Write(file,binary.LittleEndian,uint16(2));binary.Write(file,binary.LittleEndian,uint32(48000));binary.Write(file,binary.LittleEndian,uint32(48000*4));binary.Write(file,binary.LittleEndian,uint16(4));binary.Write(file,binary.LittleEndian,uint16(16))
  file.Write([]byte("data"));binary.Write(file,binary.LittleEndian,uint32(len(pcm)));file.Write(pcm);file.Close()
  fmt.Printf("bubble-%d: %d frames\n",i,len(pcm)/4)
 }
}
